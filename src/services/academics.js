import {
  addDoc, collection, deleteDoc, doc, getDoc, increment, orderBy, query, serverTimestamp, setDoc, updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';

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

// ---- Lessons (per class) ----
export const lessonsQuery = (classId) => query(collection(db, 'classes', classId, 'lessons'), orderBy('order', 'asc'));

export async function saveLesson(classId, lessonId, patch) {
  if (lessonId) {
    await updateDoc(doc(db, 'classes', classId, 'lessons', lessonId), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
    return lessonId;
  }
  const ref = await addDoc(collection(db, 'classes', classId, 'lessons'), {
    ...patch,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'classes', classId), { lessonsCount: increment(1) });
  return ref.id;
}

export async function deleteLesson(classId, lessonId) {
  await deleteDoc(doc(db, 'classes', classId, 'lessons', lessonId));
  await updateDoc(doc(db, 'classes', classId), { lessonsCount: increment(-1) });
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
