import { addDoc, collection, doc, getDoc, getDocs, increment, query, runTransaction, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import { shekelsToMinorUnits } from '../lib/constants';
import { resolveAcademicYear } from '../lib/liveAcademicYear';
import { logActivity } from './activity';
import { notifyMany } from './notifications';

export const absenceExcusesCol = collection(db, 'absenceExcuses');

export const DISCOUNT_KIND_LABELS = {
  grant: 'منحة',
  hardship: 'إعفاء إنساني',
  sibling: 'خصم إخوة',
  staff: 'خصم موظف',
  orphan: 'خصم أيتام',
  martyr: 'خصم ذوي شهداء',
  partial: 'إعفاء جزئي',
  full: 'إعفاء كامل',
  other: 'خصم آخر',
};

/**
 * Apply a tuition discount / waiver / grant on a student balance.
 * mode: 'amount' | 'percent' | 'full'
 */
export async function applyStudentDiscount({
  studentId,
  studentName,
  amountShekels,
  percent,
  mode = 'amount',
  balanceMinorUnits = 0,
  kind,
  reason,
  reference,
  notes,
  academicYear,
  actor,
}) {
  const year = await resolveAcademicYear(academicYear);
  let amountMinorUnits = 0;
  if (mode === 'full') {
    amountMinorUnits = Math.max(0, Number(balanceMinorUnits) || 0);
    if (amountMinorUnits <= 0) throw new Error('no balance to waive');
  } else if (mode === 'percent') {
    const p = Math.min(100, Math.max(1, Number(percent) || 0));
    amountMinorUnits = Math.round((Number(balanceMinorUnits) || 0) * (p / 100));
    if (amountMinorUnits <= 0) throw new Error('invalid percent');
  } else {
    amountMinorUnits = shekelsToMinorUnits(amountShekels);
  }
  if (!amountMinorUnits || amountMinorUnits <= 0) throw new Error('invalid amount');

  const today = new Date().toISOString().slice(0, 10);
  const resolvedKind = mode === 'full' ? 'full' : (kind || 'other');
  const kindLabel = DISCOUNT_KIND_LABELS[resolvedKind] || 'خصم';

  await runTransaction(db, async (tx) => {
    const discountRef = doc(collection(db, 'studentDiscounts'));
    tx.set(discountRef, {
      studentId,
      studentName: studentName || '',
      amountMinorUnits,
      mode,
      percent: mode === 'percent' ? Number(percent) : null,
      kind: resolvedKind,
      kindLabel,
      reason: (reason || '').trim() || null,
      reference: (reference || '').trim() || null,
      notes: (notes || '').trim() || null,
      academicYear: year,
      status: 'مفعّل',
      createdAt: serverTimestamp(),
      createdBy: actor?.uid || null,
      createdByName: actor?.name || null,
      createdByRole: actor?.role || null,
    });
    tx.set(doc(collection(db, 'students', studentId, 'ledger')), {
      date: today,
      item: `${kindLabel}${reason ? ` — ${reason}` : ''}`,
      debitMinorUnits: 0,
      creditMinorUnits: amountMinorUnits,
      createdAt: serverTimestamp(),
    });
    tx.update(doc(db, 'students', studentId), {
      balanceMinorUnits: increment(-amountMinorUnits),
    });
  });

  await logActivity({
    type: 'discount_applied',
    actorUid: actor?.uid,
    actorName: actor?.name,
    actorRole: actor?.role,
    summary: `${kindLabel} ${amountMinorUnits / 100} ₪ للطالب ${studentName || studentId}`,
    targetType: 'student',
    targetId: studentId,
  });
}

/**
 * Create an installment plan with equal (last absorbs remainder) installments.
 */
export async function createInstallmentPlan({
  studentId,
  studentName,
  totalShekels,
  months,
  startPeriod,
  actor,
  postFirst = true,
  notes,
  academicYear,
}) {
  const year = await resolveAcademicYear(academicYear);
  const totalMinor = shekelsToMinorUnits(totalShekels);
  const n = Math.max(2, Math.min(12, Number(months) || 2));
  if (!totalMinor || totalMinor <= 0) throw new Error('invalid total');
  const per = Math.floor(totalMinor / n);
  const remainder = totalMinor - per * n;
  const today = new Date().toISOString().slice(0, 10);
  const start = startPeriod || today.slice(0, 7);

  const planRef = await addDoc(collection(db, 'installmentPlans'), {
    studentId,
    studentName: studentName || '',
    totalMinorUnits: totalMinor,
    months: n,
    installmentMinorUnits: per,
    startPeriod: start,
    status: 'نشط',
    notes: (notes || '').trim() || null,
    academicYear: year,
    paidCount: postFirst ? 0 : 0,
    dueCount: postFirst ? 1 : 0,
    createdAt: serverTimestamp(),
    createdBy: actor?.uid || null,
    createdByName: actor?.name || null,
  });

  const batchItems = [];
  for (let i = 0; i < n; i += 1) {
    const amount = per + (i === n - 1 ? remainder : 0);
    batchItems.push({
      planId: planRef.id,
      studentId,
      studentName: studentName || '',
      index: i + 1,
      ofTotal: n,
      amountMinorUnits: amount,
      period: shiftPeriod(start, i),
      status: i === 0 && postFirst ? 'مستحق' : 'مجدول',
      academicYear,
    });
  }

  const installmentIds = await Promise.all(batchItems.map(async (item) => {
    const ref = await addDoc(collection(db, 'installments'), {
      ...item,
      createdAt: serverTimestamp(),
    });
    return { id: ref.id, ...item };
  }));

  if (postFirst) {
    const first = installmentIds[0];
    await runTransaction(db, async (tx) => {
      const studentSnap = await tx.get(doc(db, 'students', studentId));
      const student = studentSnap.exists() ? studentSnap.data() : {};
      tx.set(doc(collection(db, 'charges')), {
        studentId,
        student: studentName,
        type: `قسط 1/${n}`,
        amountMinorUnits: first.amountMinorUnits,
        discountMinorUnits: 0,
        status: 'مؤكَّد',
        method: 'تقسيط',
        planId: planRef.id,
        installmentId: first.id,
        stageId: student.stageId || null,
        stageLabel: student.stageLabel || null,
        classSection: student.classSection || null,
        grade: student.grade || null,
        createdAt: serverTimestamp(),
      });
      tx.set(doc(collection(db, 'students', studentId, 'ledger')), {
        date: today,
        item: `قسط 1/${n} — خطة تقسيط`,
        debitMinorUnits: first.amountMinorUnits,
        creditMinorUnits: 0,
        createdAt: serverTimestamp(),
      });
      tx.update(doc(db, 'students', studentId), {
        balanceMinorUnits: increment(first.amountMinorUnits),
      });
    });
  }

  await logActivity({
    type: 'installment_plan',
    actorUid: actor?.uid,
    actorName: actor?.name,
    actorRole: actor?.role,
    summary: `خطة تقسيط ${n} أشهر · ${totalMinor / 100} ₪ للطالب ${studentName || studentId}`,
    targetType: 'student',
    targetId: studentId,
  });

  return planRef.id;
}

/** Post a scheduled installment as due (charge + ledger debit). */
export async function postInstallmentDue(installmentId, { actor } = {}) {
  const today = new Date().toISOString().slice(0, 10);

  await runTransaction(db, async (tx) => {
    const instRef = doc(db, 'installments', installmentId);
    const snap = await tx.get(instRef);
    if (!snap.exists()) throw new Error('not found');
    const inst = snap.data();
    if (inst.status !== 'مجدول') throw new Error('not scheduled');

    const studentSnap = await tx.get(doc(db, 'students', inst.studentId));
    const student = studentSnap.exists() ? studentSnap.data() : {};

    tx.update(instRef, {
      status: 'مستحق',
      postedAt: serverTimestamp(),
      postedBy: actor?.uid || null,
    });
    tx.set(doc(collection(db, 'charges')), {
      studentId: inst.studentId,
      student: inst.studentName,
      type: `قسط ${inst.index}/${inst.ofTotal || '?'}`,
      amountMinorUnits: inst.amountMinorUnits,
      discountMinorUnits: 0,
      status: 'مؤكَّد',
      method: 'تقسيط',
      planId: inst.planId,
      installmentId,
      stageId: student.stageId || null,
      stageLabel: student.stageLabel || null,
      classSection: student.classSection || null,
      grade: student.grade || null,
      createdAt: serverTimestamp(),
    });
    tx.set(doc(collection(db, 'students', inst.studentId, 'ledger')), {
      date: today,
      item: `قسط ${inst.index}/${inst.ofTotal || '?'} — خطة تقسيط`,
      debitMinorUnits: inst.amountMinorUnits,
      creditMinorUnits: 0,
      createdAt: serverTimestamp(),
    });
    tx.update(doc(db, 'students', inst.studentId), {
      balanceMinorUnits: increment(inst.amountMinorUnits),
    });
  });

  await logActivity({
    type: 'installment_posted',
    actorUid: actor?.uid,
    actorName: actor?.name,
    actorRole: actor?.role,
    summary: `ترحيل قسط مستحق (${installmentId})`,
    targetType: 'installment',
    targetId: installmentId,
  });
}

/** Record payment against a due installment (credit ledger, reduce balance). */
export async function markInstallmentPaid(installmentId, { actor, method = 'نقدي' } = {}) {
  const today = new Date().toISOString().slice(0, 10);

  let planId = null;
  await runTransaction(db, async (tx) => {
    const instRef = doc(db, 'installments', installmentId);
    const snap = await tx.get(instRef);
    if (!snap.exists()) throw new Error('not found');
    const inst = snap.data();
    if (inst.status !== 'مستحق' && inst.status !== 'مجدول') throw new Error('invalid status');
    planId = inst.planId;

    // If still scheduled, treat as post+pay in one step (no double debit).
    const wasScheduled = inst.status === 'مجدول';

    tx.update(instRef, {
      status: 'مدفوع',
      paidAt: serverTimestamp(),
      paidBy: actor?.uid || null,
      paidByName: actor?.name || null,
      paymentMethod: method,
    });

    if (!wasScheduled) {
      tx.set(doc(collection(db, 'students', inst.studentId, 'ledger')), {
        date: today,
        item: `سداد قسط ${inst.index}/${inst.ofTotal || '?'}`,
        debitMinorUnits: 0,
        creditMinorUnits: inst.amountMinorUnits,
        createdAt: serverTimestamp(),
      });
      tx.update(doc(db, 'students', inst.studentId), {
        balanceMinorUnits: increment(-inst.amountMinorUnits),
      });
    } else {
      // Scheduled → paid without ever hitting balance (direct settlement)
      tx.set(doc(collection(db, 'students', inst.studentId, 'ledger')), {
        date: today,
        item: `سداد مباشر قسط ${inst.index}/${inst.ofTotal || '?'}`,
        debitMinorUnits: 0,
        creditMinorUnits: 0,
        note: `مدفوع ${inst.amountMinorUnits / 100} ₪ دون ترحيل للمستحق`,
        createdAt: serverTimestamp(),
      });
    }
  });

  if (planId) await refreshPlanStatus(planId);

  await logActivity({
    type: 'installment_paid',
    actorUid: actor?.uid,
    actorName: actor?.name,
    actorRole: actor?.role,
    summary: `سداد قسط ${installmentId}`,
    targetType: 'installment',
    targetId: installmentId,
  });
}

/** Cancel remaining scheduled installments on a plan. */
export async function cancelInstallmentPlan(planId, { actor, reason } = {}) {
  const q = query(collection(db, 'installments'), where('planId', '==', planId));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map(async (d) => {
    if (d.data().status === 'مجدول') {
      await updateDoc(d.ref, {
        status: 'ملغى',
        cancelledAt: serverTimestamp(),
        cancelReason: reason || null,
      });
    }
  }));
  await updateDoc(doc(db, 'installmentPlans', planId), {
    status: 'ملغى',
    cancelledAt: serverTimestamp(),
    cancelReason: (reason || '').trim() || null,
    cancelledBy: actor?.uid || null,
  });
  await logActivity({
    type: 'installment_cancelled',
    actorUid: actor?.uid,
    actorName: actor?.name,
    actorRole: actor?.role,
    summary: `إلغاء خطة تقسيط ${planId}`,
    targetType: 'installmentPlan',
    targetId: planId,
  });
}

async function refreshPlanStatus(planId) {
  const q = query(collection(db, 'installments'), where('planId', '==', planId));
  const snap = await getDocs(q);
  const statuses = snap.docs.map((d) => d.data().status);
  const allPaid = statuses.length > 0 && statuses.every((s) => s === 'مدفوع' || s === 'ملغى');
  const anyActive = statuses.some((s) => s === 'مجدول' || s === 'مستحق');
  await updateDoc(doc(db, 'installmentPlans', planId), {
    status: allPaid ? 'مكتمل' : anyActive ? 'نشط' : 'مكتمل',
    paidCount: statuses.filter((s) => s === 'مدفوع').length,
    updatedAt: serverTimestamp(),
  });
}

function shiftPeriod(yyyyMm, addMonths) {
  const [y, m] = yyyyMm.split('-').map(Number);
  const d = new Date(y, m - 1 + addMonths, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function submitAbsenceExcuse({
  studentId, studentName, guardianUid, guardianName, date, reason, note, teacherIds = [],
}) {
  await addDoc(absenceExcusesCol, {
    studentId,
    studentName: studentName || '',
    guardianUid,
    guardianName: guardianName || '',
    date,
    reason: reason || 'مبرَّر',
    note: (note || '').trim() || null,
    teacherIds: teacherIds || [],
    status: 'قيد المراجعة',
    createdAt: serverTimestamp(),
  });
  await notifyMany(teacherIds, {
    role: 'teacher',
    type: 'absence_excuse',
    title: 'تبرير غياب من ولي الأمر',
    body: `${studentName || 'طالب'} — ${date}${reason ? ` · ${reason}` : ''} (بانتظار الإدارة)`,
    studentId,
    studentName,
    link: studentId ? `/teacher/students/${studentId}` : '/teacher/inbox',
  });
}

export async function reviewAbsenceExcuse(excuseId, { decision, reviewer }) {
  const excuseRef = doc(db, 'absenceExcuses', excuseId);
  const snap = await getDoc(excuseRef);
  if (!snap.exists()) throw new Error('Excuse not found');
  const data = snap.data();

  await updateDoc(excuseRef, {
    status: decision === 'approve' ? 'مقبول' : 'مرفوض',
    reviewedAt: serverTimestamp(),
    reviewedBy: reviewer?.uid || null,
    reviewedByName: reviewer?.name || null,
  });

  // Notify class teachers of the decision
  const teacherIds = data.teacherIds || [];
  if (teacherIds.length === 0 && data.studentId && data.date) {
    const recSnap = await getDocs(query(
      collection(db, 'students', data.studentId, 'attendanceRecords'),
      where('date', '==', data.date),
    ));
    recSnap.docs.forEach((r) => {
      if (r.data().teacherId) teacherIds.push(r.data().teacherId);
    });
  }
  await notifyMany(teacherIds, {
    role: 'teacher',
    type: 'absence_excuse',
    title: decision === 'approve' ? 'قُبل تبرير غياب' : 'رُفض تبرير غياب',
    body: `${data.studentName || 'طالب'} — ${data.date}`,
    studentId: data.studentId,
    studentName: data.studentName,
    link: data.studentId ? `/teacher/students/${data.studentId}` : '/teacher/inbox',
  });

  if (data.guardianUid) {
    await notifyMany([data.guardianUid], {
      role: 'parent',
      type: 'absence_excuse',
      title: decision === 'approve' ? 'قُبل تبرير الغياب' : 'رُفض تبرير الغياب',
      body: `${data.studentName || 'طالب'} — ${data.date}`,
      studentId: data.studentId,
      studentName: data.studentName,
      link: '/parent/absence',
    });
  }

  // On approve: mark matching attendance rows as excused so parent/student portals match
  if (decision === 'approve' && data.studentId && data.date) {
    const recSnap = await getDocs(query(
      collection(db, 'students', data.studentId, 'attendanceRecords'),
      where('date', '==', data.date),
    ));
    if (!recSnap.empty) {
      const studentBatch = writeBatch(db);
      const sessionUpdates = [];
      recSnap.docs.forEach((r) => {
        const status = r.data().status;
        if (status === 'غائب' || status === 'متأخر') {
          studentBatch.update(r.ref, {
            status: 'مستأذن',
            excuseId,
            updatedAt: serverTimestamp(),
          });
        }
        if (r.data().classId) {
          sessionUpdates.push({ classId: r.data().classId, studentId: data.studentId });
        }
      });
      await studentBatch.commit();

      for (const { classId, studentId } of sessionUpdates) {
        try {
          await updateDoc(doc(db, 'classes', classId, 'attendanceSessions', data.date), {
            [`records.${studentId}.status`]: 'مستأذن',
          });
        } catch {
          // Session may not exist — student history already updated.
        }
      }
    }
  }
}
