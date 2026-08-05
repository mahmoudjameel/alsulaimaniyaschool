import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';

export const activityLogCol = collection(db, 'activityLog');

const ACTIVITY_ICONS = {
  student_created: 'person_add',
  grade_submitted: 'edit_note',
  grade_approved: 'task_alt',
  grade_rejected: 'cancel',
  admission_accepted: 'how_to_reg',
  expense_created: 'trending_down',
  class_created: 'menu_book',
  enrollment_added: 'assignment_ind',
  staff_created: 'badge',
  invoice_generated: 'receipt_long',
  attendance_taken: 'fact_check',
  staff_check_in: 'fingerprint',
  staff_check_out: 'logout',
  school_site_updated: 'my_location',
  payment_submitted: 'upload_file',
  payment_approved: 'verified',
  payment_rejected: 'cancel',
  disbursement_created: 'payments',
  staff_payroll_created: 'badge',
};

export function iconForActivity(type) {
  return ACTIVITY_ICONS[type] || 'notifications';
}

/**
 * Every significant write across the app calls this so the admin gets a
 * real, live audit trail (see `/admin/activity`) instead of a dashboard
 * that just shows illustrative numbers — "من رصد درجة" و"من أضاف طالباً"
 * كلّها موثّقة هنا بالفاعل والوقت.
 */
export async function logActivity({ type, actorUid, actorName, actorRole, summary, targetType, targetId }) {
  if (!isFirebaseConfigured) return; // demo mode has nothing to persist to
  await addDoc(activityLogCol, {
    type, actorUid, actorName: actorName || '—', actorRole: actorRole || '—', summary,
    targetType: targetType || null, targetId: targetId || null, createdAt: serverTimestamp(),
  });
}
