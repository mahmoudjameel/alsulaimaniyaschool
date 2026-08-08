import { addDoc, collection, deleteDoc, doc, increment, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, functions, storage } from '../firebase/config';
import { shekelsToMinorUnits } from '../lib/constants';
import { academicTuitionPeriods } from '../lib/billingPeriods';
import { isSeatReservationType, SEAT_RESERVATION_TYPE } from '../lib/feeTypes';
import { logActivity } from './activity';

export const paymentProofsCol = collection(db, 'paymentProofs');

// ---- Billing / charges ----
export const chargesCol = collection(db, 'charges');

/** Idempotently generates this period's charges from the fee templates —
 * runs server-side so a retry never double-bills a student. */
export async function generateInvoices(period) {
  const fn = httpsCallable(functions, 'generateInvoices');
  const { data } = await fn({ period });
  return data;
}

export async function confirmCharge(chargeId) {
  await updateDoc(doc(db, 'charges', chargeId), { status: 'مؤكَّد', updatedAt: serverTimestamp() });
}

/**
 * Edit an existing charge. Adjusts student balance when amount changes
 * (same net-debit model as createManualCharge).
 */
export async function updateCharge(chargeId, patch = {}) {
  const chargeRef = doc(db, 'charges', chargeId);
  const today = new Date().toISOString().slice(0, 10);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(chargeRef);
    if (!snap.exists()) throw new Error('not found');
    const prev = snap.data();
    const studentId = prev.studentId;
    if (!studentId) throw new Error('no student');

    const nextAmount = patch.amountMinorUnits != null
      ? Number(patch.amountMinorUnits)
      : Number(prev.amountMinorUnits || 0);
    const nextDiscount = patch.discountMinorUnits != null
      ? Number(patch.discountMinorUnits)
      : Number(prev.discountMinorUnits || 0);
    const amountDelta = nextAmount - Number(prev.amountMinorUnits || 0);

    const allowed = {
      updatedAt: serverTimestamp(),
    };
    if (patch.type != null) allowed.type = patch.type;
    if (patch.status != null) allowed.status = patch.status;
    if (patch.method != null) allowed.method = patch.method;
    if (patch.amountMinorUnits != null) allowed.amountMinorUnits = nextAmount;
    if (patch.discountMinorUnits != null) allowed.discountMinorUnits = Math.max(0, nextDiscount);

    tx.update(chargeRef, allowed);

    if (amountDelta !== 0) {
      tx.update(doc(db, 'students', studentId), {
        balanceMinorUnits: increment(amountDelta),
      });
      tx.set(doc(collection(db, 'students', studentId, 'ledger')), {
        date: today,
        item: amountDelta > 0
          ? `تعديل فاتورة (+${amountDelta / 100} ₪) — ${patch.type || prev.type}`
          : `تعديل فاتورة (${amountDelta / 100} ₪) — ${patch.type || prev.type}`,
        debitMinorUnits: amountDelta > 0 ? amountDelta : 0,
        creditMinorUnits: amountDelta < 0 ? -amountDelta : 0,
        chargeId,
        createdAt: serverTimestamp(),
      });
    }
  });
}

/** Delete a charge and reverse its debit on the student balance. */
export async function deleteCharge(chargeId) {
  const chargeRef = doc(db, 'charges', chargeId);
  const today = new Date().toISOString().slice(0, 10);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(chargeRef);
    if (!snap.exists()) return;
    const prev = snap.data();
    const amount = Number(prev.amountMinorUnits || 0);
    const studentId = prev.studentId;

    tx.delete(chargeRef);

    if (studentId && amount) {
      tx.update(doc(db, 'students', studentId), {
        balanceMinorUnits: increment(-amount),
      });
      tx.set(doc(collection(db, 'students', studentId, 'ledger')), {
        date: today,
        item: `حذف فاتورة — ${prev.type || 'فاتورة'}`,
        debitMinorUnits: 0,
        creditMinorUnits: amount,
        chargeId,
        createdAt: serverTimestamp(),
      });
    }
  });
}

/**
 * Accountant/admin "رفع فاتورة" flow: records a one-off charge for a
 * student (tuition, transport, uniform, …), optionally attaching a scanned
 * receipt, and keeps the student's ledger + running balance consistent in
 * one atomic transaction — same accounting discipline as the server-side
 * invoice generator, just triggered manually for a single student.
 */
export async function createManualCharge({
  studentId, studentName, type, amountShekels, method, receiptFile,
  stageId, stageLabel, classSection, grade,
}) {
  const amountMinorUnits = shekelsToMinorUnits(amountShekels);
  const today = new Date().toISOString().slice(0, 10);

  // Seat reservation is one-per-student and must stay separate from monthly tuition.
  if (isSeatReservationType(type)) {
    const chargeId = await createSeatReservationCharge({
      studentId,
      studentName,
      stageId,
      stageLabel,
      classSection,
      grade,
      amountMinorUnits,
      status: 'مؤكَّد',
      method: method || 'يدوي',
    });
    if (receiptFile && chargeId) {
      const path = `students/${studentId}/receipts/${Date.now()}-${receiptFile.name}`;
      const fileRef = ref(storage, path);
      await uploadBytes(fileRef, receiptFile);
      const receiptUrl = await getDownloadURL(fileRef);
      await updateDoc(doc(db, 'charges', chargeId), { receiptUrl, updatedAt: serverTimestamp() });
      await addDoc(collection(db, 'students', studentId, 'documents'), {
        name: `إيصال — ${SEAT_RESERVATION_TYPE}`,
        type: receiptFile.type.includes('pdf') ? 'PDF' : 'صورة',
        date: today,
        status: 'موثّق',
        tone: 'accent',
        url: receiptUrl,
      });
    }
    return chargeId;
  }

  let receiptUrl = null;
  if (receiptFile) {
    const path = `students/${studentId}/receipts/${Date.now()}-${receiptFile.name}`;
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, receiptFile);
    receiptUrl = await getDownloadURL(fileRef);
  }

  await runTransaction(db, async (tx) => {
    const chargeRef = doc(collection(db, 'charges'));
    tx.set(chargeRef, {
      studentId,
      student: studentName,
      type,
      amountMinorUnits,
      discountMinorUnits: 0,
      status: 'مؤكَّد',
      method: method || 'يدوي',
      receiptUrl,
      stageId: stageId || null,
      stageLabel: stageLabel || null,
      classSection: classSection || null,
      grade: grade || null,
      createdAt: serverTimestamp(),
    });
    tx.set(doc(collection(db, 'students', studentId, 'ledger')), {
      date: today, item: type, debitMinorUnits: amountMinorUnits, creditMinorUnits: 0, createdAt: serverTimestamp(),
    });
    if (receiptUrl) {
      tx.set(doc(collection(db, 'students', studentId, 'documents')), {
        name: `إيصال — ${type}`, type: receiptFile.type.includes('pdf') ? 'PDF' : 'صورة',
        date: today, status: 'موثّق', tone: 'accent', url: receiptUrl,
      });
    }
    tx.update(doc(db, 'students', studentId), { balanceMinorUnits: increment(amountMinorUnits) });
  });
}

/**
 * Seat reservation fee for a stage — one charge per student
 * (`{studentId}_seat_reservation`), separate from monthly tuition.
 * Idempotent create; optional patch for status/method/amount on existing.
 */
export async function createSeatReservationCharge({
  studentId, studentName, stageId, stageLabel, amountMinorUnits,
  classSection, grade, status, method,
}) {
  const amount = Number(amountMinorUnits) || 0;
  if (!studentId || amount <= 0) return null;

  const chargeId = `${studentId}_seat_reservation`;
  const chargeRef = doc(db, 'charges', chargeId);
  const today = new Date().toISOString().slice(0, 10);

  await runTransaction(db, async (tx) => {
    const existing = await tx.get(chargeRef);
    if (existing.exists()) {
      const prev = existing.data();
      const patch = { updatedAt: serverTimestamp() };
      if (status != null) patch.status = status;
      if (method != null) patch.method = method;
      if (amount !== Number(prev.amountMinorUnits || 0)) {
        const delta = amount - Number(prev.amountMinorUnits || 0);
        patch.amountMinorUnits = amount;
        if (delta !== 0) {
          tx.update(doc(db, 'students', studentId), { balanceMinorUnits: increment(delta) });
          tx.set(doc(collection(db, 'students', studentId, 'ledger')), {
            date: today,
            item: delta > 0 ? `تعديل حجز مقعد (+${delta / 100} ₪)` : `تعديل حجز مقعد (${delta / 100} ₪)`,
            debitMinorUnits: delta > 0 ? delta : 0,
            creditMinorUnits: delta < 0 ? -delta : 0,
            chargeId,
            createdAt: serverTimestamp(),
          });
        }
      }
      tx.update(chargeRef, patch);
      return;
    }
    tx.set(chargeRef, {
      studentId,
      student: studentName || '—',
      type: 'حجز مقعد',
      amountMinorUnits: amount,
      discountMinorUnits: 0,
      status: status || 'مسودّة',
      method: method || '—',
      stageId: stageId || null,
      stageLabel: stageLabel || null,
      classSection: classSection || null,
      grade: grade || stageLabel || null,
      createdAt: serverTimestamp(),
    });
    tx.set(doc(collection(db, 'students', studentId, 'ledger')), {
      date: today,
      item: `حجز مقعد${stageLabel ? ` — ${stageLabel}` : ''}`,
      debitMinorUnits: amount,
      creditMinorUnits: 0,
      chargeId,
      createdAt: serverTimestamp(),
    });
    tx.update(doc(db, 'students', studentId), { balanceMinorUnits: increment(amount) });
  });
  return chargeId;
}

/**
 * Create 10 monthly tuition draft charges for the academic year
 * (same doc ids as generateInvoices: `{studentId}_{YYYY-MM}_tuition`).
 * Idempotent — skips periods that already exist.
 */
export async function createAcademicYearTuitionPlan({
  studentId,
  studentName,
  stageId,
  stageLabel,
  classSection,
  grade,
  academicYear,
  monthlyTuitionMinorUnits,
}) {
  const monthly = Number(monthlyTuitionMinorUnits) || 0;
  if (!studentId || monthly <= 0) {
    return { created: 0, skipped: 0, periods: [], monthlyMinorUnits: 0 };
  }

  const periods = academicTuitionPeriods(academicYear);
  const today = new Date().toISOString().slice(0, 10);
  let created = 0;
  let skipped = 0;
  const createdPeriods = [];

  for (const { period, labelAr } of periods) {
    const chargeId = `${studentId}_${period}_tuition`;
    const chargeRef = doc(db, 'charges', chargeId);
    let didCreate = false;
    // eslint-disable-next-line no-await-in-loop
    await runTransaction(db, async (tx) => {
      didCreate = false;
      const existing = await tx.get(chargeRef);
      if (existing.exists()) return;
      tx.set(chargeRef, {
        studentId,
        student: studentName || '—',
        period,
        periodLabel: labelAr,
        type: 'رسوم دراسية شهرية',
        amountMinorUnits: monthly,
        discountMinorUnits: 0,
        status: 'مسودّة',
        method: '—',
        stageId: stageId || null,
        stageLabel: stageLabel || null,
        classSection: classSection || null,
        grade: grade || stageLabel || null,
        academicYear: academicYear || null,
        createdAt: serverTimestamp(),
      });
      tx.set(doc(collection(db, 'students', studentId, 'ledger')), {
        date: today,
        item: `رسوم دراسية — ${labelAr}`,
        debitMinorUnits: monthly,
        creditMinorUnits: 0,
        chargeId,
        period,
        createdAt: serverTimestamp(),
      });
      tx.update(doc(db, 'students', studentId), {
        balanceMinorUnits: increment(monthly),
      });
      didCreate = true;
    });
    if (didCreate) {
      created += 1;
      createdPeriods.push({ period, labelAr, amountMinorUnits: monthly });
    } else {
      skipped += 1;
    }
  }

  return {
    created,
    skipped,
    periods: createdPeriods,
    monthlyMinorUnits: monthly,
    months: periods.length,
  };
}

// ---- Expenses ----
export const expensesCol = collection(db, 'expenses');

export async function createExpense({ vendor, category, amountShekels, kind }) {
  const ref = await addDoc(expensesCol, {
    date: new Date().toISOString().slice(0, 10),
    vendor: vendor || 'مورّد',
    category: category || 'مستهلكات',
    kind: kind || (category === 'مستهلكات' ? 'consumable' : 'expense'),
    amountMinorUnits: shekelsToMinorUnits(amountShekels),
    status: 'قيد الدفع',
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateExpense(id, { vendor, category, amountShekels, status, kind }) {
  const patch = { updatedAt: serverTimestamp() };
  if (vendor != null) patch.vendor = vendor;
  if (category != null) patch.category = category;
  if (kind != null) patch.kind = kind;
  if (status != null) patch.status = status;
  if (amountShekels != null) patch.amountMinorUnits = shekelsToMinorUnits(amountShekels);
  await updateDoc(doc(db, 'expenses', id), patch);
}

export async function deleteExpense(id) {
  await deleteDoc(doc(db, 'expenses', id));
}

/**
 * Parent submits a bank-transfer payment proof: receipt image + payer/bank
 * details. Balance is NOT touched until admin/accountant approves.
 */
export async function submitPaymentProof({
  studentId, studentName, guardianUid, guardianName,
  amountShekels, bankAccountName, payerName, payerPhone,
  transferRef, note, receiptFile, actor,
}) {
  if (!receiptFile) throw new Error('receipt required');
  const amountMinorUnits = shekelsToMinorUnits(amountShekels);
  if (!amountMinorUnits || amountMinorUnits <= 0) throw new Error('invalid amount');

  const path = `students/${studentId}/payment-proofs/${Date.now()}-${receiptFile.name}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, receiptFile);
  const receiptUrl = await getDownloadURL(fileRef);

  const docRef = await addDoc(paymentProofsCol, {
    studentId,
    studentName: studentName || '',
    guardianUid,
    guardianName: guardianName || '',
    amountMinorUnits,
    bankAccountName: (bankAccountName || '').trim(),
    payerName: (payerName || '').trim(),
    payerPhone: (payerPhone || '').trim(),
    transferRef: (transferRef || '').trim() || null,
    note: (note || '').trim() || null,
    receiptUrl,
    status: 'قيد المراجعة',
    createdAt: serverTimestamp(),
    reviewedAt: null,
    reviewedBy: null,
    reviewedByName: null,
    rejectionReason: null,
  });

  await logActivity({
    type: 'payment_submitted',
    actorUid: actor?.uid || guardianUid,
    actorName: actor?.name || guardianName,
    actorRole: 'parent',
    summary: `إرسال وصل دفع ${amountShekels} ₪ للطالب ${studentName}`,
    targetType: 'paymentProof',
    targetId: docRef.id,
  }).catch(() => {});

  return docRef.id;
}

/**
 * Approve a pending payment proof: credit the student ledger and reduce
 * balanceMinorUnits atomically. Only staff with billing.manage may call this
 * (enforced by firestore.rules).
 */
export async function approvePaymentProof(proofId, actor) {
  const today = new Date().toISOString().slice(0, 10);
  let summaryMeta = { studentName: '', amountMinorUnits: 0 };

  await runTransaction(db, async (tx) => {
    const proofRef = doc(db, 'paymentProofs', proofId);
    const proofSnap = await tx.get(proofRef);
    if (!proofSnap.exists()) throw new Error('not found');
    const proof = proofSnap.data();
    if (proof.status !== 'قيد المراجعة') throw new Error('already reviewed');

    const studentRef = doc(db, 'students', proof.studentId);
    const studentSnap = await tx.get(studentRef);
    if (!studentSnap.exists()) throw new Error('student missing');

    summaryMeta = { studentName: proof.studentName, amountMinorUnits: proof.amountMinorUnits };

    tx.update(proofRef, {
      status: 'معتمد',
      reviewedAt: serverTimestamp(),
      reviewedBy: actor?.uid || null,
      reviewedByName: actor?.name || '',
      rejectionReason: null,
    });

    tx.set(doc(collection(db, 'students', proof.studentId, 'ledger')), {
      date: today,
      item: `دفعة تحويل بنكي — ${proof.payerName}${proof.transferRef ? ` (#${proof.transferRef})` : ''}`,
      debitMinorUnits: 0,
      creditMinorUnits: proof.amountMinorUnits,
      paymentProofId: proofId,
      createdAt: serverTimestamp(),
    });

    if (proof.receiptUrl) {
      tx.set(doc(collection(db, 'students', proof.studentId, 'documents')), {
        name: `وصل دفع — ${proof.payerName}`,
        type: 'صورة',
        date: today,
        status: 'موثّق',
        tone: 'accent',
        url: proof.receiptUrl,
      });
    }

    tx.update(studentRef, { balanceMinorUnits: increment(-proof.amountMinorUnits) });
  });

  await logActivity({
    type: 'payment_approved',
    actorUid: actor?.uid,
    actorName: actor?.name,
    actorRole: actor?.role,
    summary: `اعتماد دفعة ${summaryMeta.amountMinorUnits / 100} ₪ للطالب ${summaryMeta.studentName}`,
    targetType: 'paymentProof',
    targetId: proofId,
  }).catch(() => {});
}

/** Reject a pending payment proof — no ledger/balance change. */
export async function rejectPaymentProof(proofId, actor, rejectionReason = '') {
  const proofRef = doc(db, 'paymentProofs', proofId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(proofRef);
    if (!snap.exists()) throw new Error('not found');
    if (snap.data().status !== 'قيد المراجعة') throw new Error('already reviewed');
    tx.update(proofRef, {
      status: 'مرفوض',
      reviewedAt: serverTimestamp(),
      reviewedBy: actor?.uid || null,
      reviewedByName: actor?.name || '',
      rejectionReason: (rejectionReason || '').trim() || 'لم يُقبل الوصل',
    });
  });

  await logActivity({
    type: 'payment_rejected',
    actorUid: actor?.uid,
    actorName: actor?.name,
    actorRole: actor?.role,
    summary: `رفض وصل دفع${rejectionReason ? `: ${rejectionReason}` : ''}`,
    targetType: 'paymentProof',
    targetId: proofId,
  }).catch(() => {});
}

// ---- Payroll ----
export const payrollCol = collection(db, 'payroll');

const PAYROLL_STAGE_ACTIONS = {
  open: 'computePayroll',
  computed: 'approvePayroll',
  approved: 'disbursePayroll',
};

/** Advances every payroll row for the period to the next stage. The heavy
 * lifting (days-worked lookup from attendance, net-pay math) happens in the
 * Cloud Function so the client never computes money. At the "paid" stage
 * this instead downloads the period's CSV export (see exportPayrollCsv). */
export async function advancePayrollStage(period, currentStage) {
  const action = PAYROLL_STAGE_ACTIONS[currentStage];
  if (!action) return exportPayrollCsv(period);
  const fn = httpsCallable(functions, action);
  return fn({ period });
}

/** Fetches the paid period's CSV from the callable and triggers a browser
 * download — no public HTTP endpoint/IAM invoker grant required. */
export async function exportPayrollCsv(period) {
  const fn = httpsCallable(functions, 'payrollExport');
  const { data } = await fn({ period });
  const blob = new Blob([data.csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = data.filename;
  a.click();
  URL.revokeObjectURL(url);
}
