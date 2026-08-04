import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { shekelsToMinorUnits } from '../lib/constants';
import { logActivity } from './activity';

export const disbursementsCol = collection(db, 'disbursements');

/**
 * Record an advance, shift payment, or consumable purchase —
 * the accountant's day-to-day cash flow categories.
 */
export async function createDisbursement({
  kind, amountShekels, staffId, staffName, hours, rateShekels,
  vendor, period, note, actor,
}) {
  const amountMinorUnits = kind === 'shift' && hours && rateShekels
    ? Math.round(Number(hours) * shekelsToMinorUnits(rateShekels))
    : shekelsToMinorUnits(amountShekels);

  if (!amountMinorUnits || amountMinorUnits <= 0) throw new Error('invalid amount');

  const ref = await addDoc(disbursementsCol, {
    kind, // advance | shift | consumable
    amountMinorUnits,
    staffId: staffId || null,
    staffName: staffName || null,
    hours: hours != null ? Number(hours) : null,
    rateMinorUnits: rateShekels != null ? shekelsToMinorUnits(rateShekels) : null,
    vendor: vendor || null,
    period: period || null,
    note: (note || '').trim() || null,
    status: 'قيد الدفع',
    createdBy: actor?.uid || null,
    createdByName: actor?.name || null,
    createdAt: serverTimestamp(),
    paidAt: null,
  });

  await logActivity({
    type: 'disbursement_created',
    actorUid: actor?.uid,
    actorName: actor?.name,
    actorRole: actor?.role,
    summary: `تسجيل ${kindLabel(kind)} بمبلغ ${amountMinorUnits / 100} ₪`,
    targetType: 'disbursement',
    targetId: ref.id,
  }).catch(() => {});

  return ref.id;
}

export async function markDisbursementPaid(id, actor) {
  await updateDoc(doc(db, 'disbursements', id), {
    status: 'مدفوع',
    paidAt: serverTimestamp(),
    paidBy: actor?.uid || null,
    paidByName: actor?.name || null,
  });
}

function kindLabel(kind) {
  return { advance: 'سلفة', shift: 'وردية', consumable: 'مستهلكات', salary: 'راتب' }[kind] || kind;
}
