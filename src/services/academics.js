import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, increment, orderBy, query, serverTimestamp, setDoc, updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { logActivity } from './activity';

// ---- Classes ----
export const classesCol = collection(db, 'classes');

export async function createClass({ title, subject, teacherId, teacherName, grade, shift, visibility, schedule }) {
  const ref = await addDoc(classesCol, {
    title: title || 'صفّ جديد',
    subject: subject || 'لغة عربية',
    teacherId: teacherId || null,
    teacher: teacherName || 'غير محدّد', // denormalized display name — kept even if the teacher profile later changes
    grade: grade || '',
    shift: shift || 'صباحي',
    visibility: visibility || 'المدرسة',
    schedule: schedule || [],
    lessonsCount: 0,
    studentsCount: 0,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Admin updates class meta, assigned teacher, and/or weekly schedule. */
export async function updateClass(classId, patch = {}) {
  const allowed = {};
  if (patch.title != null) allowed.title = patch.title;
  if (patch.subject != null) allowed.subject = patch.subject;
  if (patch.grade != null) allowed.grade = patch.grade;
  if (patch.shift != null) allowed.shift = patch.shift;
  if (patch.visibility != null) allowed.visibility = patch.visibility;
  if (patch.teacherId !== undefined) allowed.teacherId = patch.teacherId || null;
  if (patch.teacherName != null) allowed.teacher = patch.teacherName;
  if (patch.schedule != null) allowed.schedule = patch.schedule;
  allowed.updatedAt = serverTimestamp();
  await updateDoc(doc(db, 'classes', classId), allowed);
}

/** Recompute denormalized studentsCount from enrollments (repair stale/seed fields). */
export async function syncClassStudentsCount(classId) {
  const snap = await getDocs(collection(db, 'classes', classId, 'enrollments'));
  const n = snap.size;
  await updateDoc(doc(db, 'classes', classId), {
    studentsCount: n,
    students: n, // keep legacy field in sync if present in UI fallbacks
  });
  return n;
}

// ---- Enrollment (students ↔ classes, kept in sync both directions) ----
export const enrollmentsQuery = (classId) => query(collection(db, 'classes', classId, 'enrollments'), orderBy('enrolledAt', 'asc'));

export async function enrollStudent(classId, classInfo, student) {
  const enrollmentRef = doc(db, 'classes', classId, 'enrollments', student.id);
  const existing = await getDoc(enrollmentRef);
  if (existing.exists()) return; // already enrolled — no-op, never double-counts

  await setDoc(enrollmentRef, {
    studentId: student.id, studentName: student.name, displayId: student.displayId,
    grade: student.grade, enrolledAt: serverTimestamp(),
  });
  await setDoc(doc(db, 'students', student.id, 'classes', classId), {
    subject: classInfo.subject, title: classInfo.title, teacher: classInfo.teacher,
    teacherId: classInfo.teacherId || null, shift: classInfo.shift || null, grade: '—',
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'classes', classId), { studentsCount: increment(1) });
}

export async function unenrollStudent(classId, studentId) {
  const enrollmentRef = doc(db, 'classes', classId, 'enrollments', studentId);
  const existing = await getDoc(enrollmentRef);
  if (!existing.exists()) return;

  await deleteDoc(enrollmentRef);
  await deleteDoc(doc(db, 'students', studentId, 'classes', classId));
  await updateDoc(doc(db, 'classes', classId), { studentsCount: increment(-1) });
}

/** Remove a student from every class enrollment (both sides). Returns count cleared. */
export async function clearStudentEnrollments(studentId) {
  const snap = await getDocs(collection(db, 'students', studentId, 'classes'));
  let n = 0;
  for (const d of snap.docs) {
    await unenrollStudent(d.id, studentId);
    n += 1;
  }
  return n;
}

// ---- Lessons (per class) ----
export const lessonsQuery = (classId) => query(collection(db, 'classes', classId, 'lessons'), orderBy('order', 'asc'));

export async function saveLesson(classId, lessonId, patch) {
  if (lessonId) {
    await updateDoc(doc(db, 'classes', classId, 'lessons', lessonId), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  } else {
    const ref = await addDoc(collection(db, 'classes', classId, 'lessons'), {
      ...patch,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'classes', classId), { lessonsCount: increment(1) });
    lessonId = ref.id;
  }
  await logActivity({
    type: patch.status === 'منشور' ? 'lesson_published' : 'lesson_saved',
    actorUid: patch.authorId,
    actorName: patch.authorName,
    actorRole: 'teacher',
    summary: `${patch.status === 'منشور' ? 'نشر' : 'حفظ'} درس «${patch.title || 'بدون عنوان'}»`,
    targetType: 'class',
    targetId: classId,
  });
  return lessonId;
}

export async function deleteLesson(classId, lessonId, meta = {}) {
  await deleteDoc(doc(db, 'classes', classId, 'lessons', lessonId));
  await updateDoc(doc(db, 'classes', classId), { lessonsCount: increment(-1) });
  if (meta.actorUid) {
    await logActivity({
      type: 'lesson_deleted',
      actorUid: meta.actorUid,
      actorName: meta.actorName,
      actorRole: 'teacher',
      summary: 'حذف درس من الصف',
      targetType: 'class',
      targetId: classId,
    });
  }
}

// ---- Quizzes (per class) ----
export const quizzesQuery = (classId) => query(collection(db, 'classes', classId, 'quizzes'), orderBy('createdAt', 'desc'));

export async function saveQuiz(classId, quizId, patch) {
  if (quizId) {
    await updateDoc(doc(db, 'classes', classId, 'quizzes', quizId), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
    return quizId;
  }
  const ref = await addDoc(collection(db, 'classes', classId, 'quizzes'), {
    ...patch,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteQuiz(classId, quizId) {
  await deleteDoc(doc(db, 'classes', classId, 'quizzes', quizId));
}
