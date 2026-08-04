import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { logActivity } from './activity';
import { createNotification, notifyMany } from './notifications';

export const staffRequestsCol = collection(db, 'staffRequests');

/** Teacher → admin: request a guardian meeting about a student. */
export async function createMeetingRequest({
  teacherId, teacherName, studentId, studentName, classId, className, reason, preferredTime,
}) {
  const ref = await addDoc(staffRequestsCol, {
    kind: 'meeting',
    status: 'قيد المراجعة',
    teacherId,
    teacherName: teacherName || '',
    studentId,
    studentName: studentName || '',
    classId: classId || null,
    className: className || '',
    reason: (reason || '').trim(),
    preferredTime: (preferredTime || '').trim() || null,
    createdAt: serverTimestamp(),
  });
  await logActivity({
    type: 'meeting_requested',
    actorUid: teacherId,
    actorName: teacherName,
    actorRole: 'teacher',
    summary: `طلب اجتماع ولي أمر بخصوص ${studentName}`,
    targetType: 'student',
    targetId: studentId,
  });
  return ref.id;
}

/** Teacher → admin/reception: cover / class swap when absent. */
export async function createCoverRequest({
  teacherId, teacherName, classId, className, date, periodLabel, reason, note,
}) {
  const ref = await addDoc(staffRequestsCol, {
    kind: 'cover',
    status: 'قيد المراجعة',
    teacherId,
    teacherName: teacherName || '',
    classId: classId || null,
    className: className || '',
    date: date || null,
    periodLabel: periodLabel || null,
    reason: (reason || '').trim(),
    note: (note || '').trim() || null,
    studentId: null,
    studentName: null,
    createdAt: serverTimestamp(),
  });
  await logActivity({
    type: 'cover_requested',
    actorUid: teacherId,
    actorName: teacherName,
    actorRole: 'teacher',
    summary: `طلب تغطية/استبدال — ${className || 'حصة'} (${date || ''})`,
    targetType: 'class',
    targetId: classId || ref.id,
  });
  return ref.id;
}

export async function reviewStaffRequest(requestId, { decision, reviewer, note, notifyTeacherId }) {
  const status = decision === 'approve' ? 'مقبول' : decision === 'done' ? 'تمّ' : 'مرفوض';
  await updateDoc(doc(db, 'staffRequests', requestId), {
    status,
    reviewedAt: serverTimestamp(),
    reviewedBy: reviewer?.uid || null,
    reviewedByName: reviewer?.name || null,
    reviewNote: (note || '').trim() || null,
  });
  if (notifyTeacherId) {
    await createNotification({
      userId: notifyTeacherId,
      role: 'teacher',
      type: 'staff_request',
      title: status === 'مقبول' || status === 'تمّ' ? 'تمّت معالجة طلبك' : 'تم رفض الطلب',
      body: note || `حالة الطلب: ${status}`,
      link: '/teacher/requests',
    });
  }
}

/** Admin alert to class teachers about a student. */
export async function sendAdminStudentAlert({
  teacherIds, adminId, adminName, studentId, studentName, classId, message,
}) {
  await notifyMany(teacherIds, {
    role: 'teacher',
    type: 'admin_alert',
    title: `تنبيه إدارة — ${studentName || 'طالب'}`,
    body: message,
    studentId,
    studentName,
    classId,
    link: studentId ? `/teacher/students/${studentId}` : '/teacher/inbox',
    meta: { fromAdminId: adminId, fromAdminName: adminName },
  });
  await logActivity({
    type: 'admin_student_alert',
    actorUid: adminId,
    actorName: adminName,
    actorRole: 'admin',
    summary: `تنبيه للمعلّمين بخصوص ${studentName}`,
    targetType: 'student',
    targetId: studentId,
  });
}
