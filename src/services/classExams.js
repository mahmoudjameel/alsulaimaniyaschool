import { addDoc, collection, doc, getDoc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { logActivity } from './activity';
import { notifyMany } from './notifications';
import { assertTermOpen, fetchAcademicCalendar } from './academicCalendar';

export const classExamsCol = collection(db, 'classExams');

/** Resolve guardian + student Auth UIDs for everyone enrolled in a class. */
async function resolveClassFamilyUids(classId) {
  if (!classId) return { parentIds: [], studentIds: [] };
  const enrollSnap = await getDocs(collection(db, 'classes', classId, 'enrollments'));
  const parentIds = [];
  const studentIds = [];
  await Promise.all(enrollSnap.docs.map(async (e) => {
    const stuSnap = await getDoc(doc(db, 'students', e.id));
    if (!stuSnap.exists()) return;
    const d = stuSnap.data();
    if (d.guardianUid) parentIds.push(d.guardianUid);
    if (d.studentUid) studentIds.push(d.studentUid);
  }));
  return { parentIds, studentIds };
}

export async function submitClassExam({
  classId, className, subject, teacherId, teacherName,
  title, examDate, startTime, endTime, notes, grade, term,
}) {
  await assertTermOpen(term);
  const cal = await fetchAcademicCalendar();
  const ref = await addDoc(classExamsCol, {
    classId,
    className: className || '',
    subject: subject || '',
    teacherId,
    teacherName: teacherName || '',
    title: (title || '').trim(),
    examDate,
    startTime: startTime || null,
    endTime: endTime || null,
    notes: (notes || '').trim() || null,
    grade: grade || null,
    term: term || null,
    academicYear: cal.academicYear || '',
    status: 'قيد المراجعة',
    createdAt: serverTimestamp(),
  });
  await logActivity({
    type: 'exam_submitted',
    actorUid: teacherId,
    actorName: teacherName,
    actorRole: 'teacher',
    summary: `موعد اختبار «${title}» — ${className} (${examDate})`,
    targetType: 'classExam',
    targetId: ref.id,
  });
  return ref.id;
}

export async function approveClassExam(exam, decidedBy, { studentGuardianUserIds = [] } = {}) {
  await updateDoc(doc(db, 'classExams', exam.id), {
    status: 'معتمد',
    decidedAt: serverTimestamp(),
    decidedBy: decidedBy.uid,
    decidedByName: decidedBy.name || '',
  });
  await logActivity({
    type: 'exam_approved',
    actorUid: decidedBy.uid,
    actorName: decidedBy.name,
    actorRole: decidedBy.role || 'admin',
    summary: `اعتماد اختبار «${exam.title}» — ${exam.className}`,
    targetType: 'classExam',
    targetId: exam.id,
  });
  if (exam.teacherId) {
    await notifyMany([exam.teacherId], {
      role: 'teacher',
      type: 'exam_approved',
      title: 'اعتُمد موعد اختبار',
      body: `«${exam.title}» — ${exam.className} بتاريخ ${exam.examDate}`,
      classId: exam.classId,
      link: '/teacher/exams',
    });
  }

  let parentIds = [...(studentGuardianUserIds || [])];
  let studentIds = [];
  try {
    const resolved = await resolveClassFamilyUids(exam.classId);
    parentIds = [...parentIds, ...resolved.parentIds];
    studentIds = resolved.studentIds;
  } catch {
    // fall through with any explicitly passed IDs
  }

  const body = `${exam.className || ''} — ${exam.examDate}${exam.startTime ? ` · ${exam.startTime}` : ''}`;
  await notifyMany(parentIds, {
    role: 'parent',
    type: 'exam_scheduled',
    title: `اختبار: ${exam.title}`,
    body,
    classId: exam.classId,
    link: '/parent/exams',
  });
  await notifyMany(studentIds, {
    role: 'student',
    type: 'exam_scheduled',
    title: `اختبار: ${exam.title}`,
    body,
    classId: exam.classId,
    link: '/student/exams',
  });
}

export async function rejectClassExam(exam, decidedBy) {
  await updateDoc(doc(db, 'classExams', exam.id), {
    status: 'مرفوض',
    decidedAt: serverTimestamp(),
    decidedBy: decidedBy.uid,
    decidedByName: decidedBy.name || '',
  });
  if (exam.teacherId) {
    await notifyMany([exam.teacherId], {
      role: 'teacher',
      type: 'exam_rejected',
      title: 'رُفض موعد اختبار',
      body: `«${exam.title}» — ${exam.className}`,
      classId: exam.classId,
      link: '/teacher/exams',
    });
  }
}
