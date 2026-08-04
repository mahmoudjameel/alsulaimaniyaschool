import { addDoc, collection, doc, increment, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, functions, storage } from '../firebase/config';
import { shekelsToMinorUnits } from '../lib/constants';
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
  await updateDoc(doc(db, 'charges', chargeId), { status: 'مؤكَّد' });
}

/**
 * Accountant/admin "رفع فاتورة" flow: records a one-off charge for a
 * student (tuition, transport, uniform, …), optionally attaching a scanned
 * receipt, and keeps the student's ledger + running balance consistent in
 * one atomic transaction — same accounting discipline as the server-side
 * invoice generator, just triggered manually for a single student.
 */
export async function createManualCharge({ studentId, studentName, type, amountShekels, method, receiptFile }) {
  const amountMinorUnits = shekelsToMinorUnits(amountShekels);
  const today = new Date().toISOString().slice(0, 10);

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
      studentId, student: studentName, type, amountMinorUnits, discountMinorUnits: 0,
      status: 'مؤكَّد', method: method || 'يدوي', receiptUrl, createdAt: serverTimestamp(),
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
