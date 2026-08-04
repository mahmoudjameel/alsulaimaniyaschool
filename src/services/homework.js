import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { logActivity } from './activity';

/** Deterministic id for diary homework: student + class + date */
export function homeworkSubmissionId({ studentId, classId, date, source = 'dayLog' }) {
  return `${studentId}__${classId}__${date}__${source}`;
}

export async function markHomeworkSubmitted({
  studentId, studentName, classId, className, date, title, teacherId,
  submittedByUid, submittedByName, submittedByRole = 'student',
}) {
  const id = homeworkSubmissionId({ studentId, classId, date, source: 'dayLog' });
  await setDoc(doc(db, 'homeworkSubmissions', id), {
    studentId,
    studentName: studentName || '',
    classId,
    className: className || '',
    date,
    title: title || '',
    source: 'dayLog',
    teacherId: teacherId || null,
    status: 'تم التسليم',
    submittedByUid: submittedByUid || null,
    submittedByName: submittedByName || '',
    submittedByRole,
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return id;
}

export async function clearHomeworkSubmission(id) {
  await updateDoc(doc(db, 'homeworkSubmissions', id), {
    status: 'مطلوب',
    clearedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function saveAttendanceTemplate({ classId, teacherId, teacherName, records }) {
  await setDoc(doc(db, 'classes', classId, 'attendanceTemplates', 'default'), {
    classId,
    teacherId,
    teacherName: teacherName || '',
    records: records || {},
    updatedAt: serverTimestamp(),
  }, { merge: true });
  await logActivity({
    type: 'attendance_template_saved',
    actorUid: teacherId,
    actorName: teacherName,
    actorRole: 'teacher',
    summary: `حفظ نموذج حضور للصف ${classId}`,
    targetType: 'class',
    targetId: classId,
  });
}
