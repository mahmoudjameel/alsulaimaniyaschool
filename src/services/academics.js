import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, increment, orderBy, query, serverTimestamp, setDoc, updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { logActivity } from './activity';
import { filterClassesForStudent, filterStudentsForClass } from '../lib/classPlacement';

// ---- Classes ----
export const classesCol = collection(db, 'classes');

export async function createClass({
  title, subject, subjects, teacherId, teacherIds, teacherName, teacher,
  grade, classSection, shift, visibility, schedule,
}) {
  const subjectList = Array.isArray(subjects) && subjects.length
    ? subjects.map((s) => String(s).trim()).filter(Boolean)
    : (subject ? [String(subject).trim()] : ['لغة عربية']);
  const subjectLabel = subjectList.join(' · ');
  const ids = Array.isArray(teacherIds) && teacherIds.length
    ? [...new Set(teacherIds.filter(Boolean))]
    : (teacherId ? [teacherId] : []);
  const primaryId = teacherId || ids[0] || null;
  const payload = {
    title: title || 'صفّ جديد',
    subject: subjectLabel,
    subjects: subjectList,
    teacherId: primaryId,
    teacherIds: ids,
    teacher: teacher || teacherName || 'غير محدّد',
    grade: grade || '',
    classSection: classSection || null,
    shift: shift || 'صباحي',
    visibility: visibility || 'المدرسة',
    schedule: schedule || [],
    lessonsCount: 0,
    studentsCount: 0,
    createdAt: serverTimestamp(),
  };
  const ref = await addDoc(classesCol, payload);
  // Place existing students whose مرحلة/شعبة/دوام match this classroom.
  try {
    await enrollMatchingStudentsIntoClass(ref.id, { id: ref.id, ...payload });
  } catch {
    // Class exists even if bulk place fails; admin can re-sync from student profile.
  }
  return ref.id;
}

/** Admin updates class meta, assigned teachers, and/or weekly schedule. */
export async function updateClass(classId, patch = {}) {
  const allowed = {};
  if (patch.title != null) allowed.title = patch.title;
  if (patch.subjects != null || patch.subject != null) {
    const subjectList = Array.isArray(patch.subjects) && patch.subjects.length
      ? patch.subjects.map((s) => String(s).trim()).filter(Boolean)
      : (patch.subject ? [String(patch.subject).trim()] : ['لغة عربية']);
    allowed.subjects = subjectList;
    allowed.subject = subjectList.join(' · ');
  }
  if (patch.grade != null) allowed.grade = patch.grade;
  if (patch.classSection !== undefined) allowed.classSection = patch.classSection || null;
  if (patch.shift != null) allowed.shift = patch.shift;
  if (patch.visibility != null) allowed.visibility = patch.visibility;
  if (patch.teacherIds != null) {
    allowed.teacherIds = [...new Set((patch.teacherIds || []).filter(Boolean))];
  }
  if (patch.teacherId !== undefined) allowed.teacherId = patch.teacherId || null;
  if (patch.teacher != null) allowed.teacher = patch.teacher;
  else if (patch.teacherName != null) allowed.teacher = patch.teacherName;
  if (patch.schedule != null) allowed.schedule = patch.schedule;
  allowed.updatedAt = serverTimestamp();
  await updateDoc(doc(db, 'classes', classId), allowed);
}

/** Soft-safe delete of a class document (enrollments remain orphaned unless cleaned separately). */
export async function deleteClass(classId) {
  await deleteDoc(doc(db, 'classes', classId));
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
  if (existing.exists()) return false; // already enrolled — no-op, never double-counts

  await setDoc(enrollmentRef, {
    studentId: student.id, studentName: student.name, displayId: student.displayId,
    grade: student.grade, enrolledAt: serverTimestamp(),
  });
  await setDoc(doc(db, 'students', student.id, 'classes', classId), {
    subject: classInfo.subject || '',
    subjects: classInfo.subjects || null,
    title: classInfo.title,
    teacher: classInfo.teacher || '',
    teacherId: classInfo.teacherId || null,
    teacherIds: Array.isArray(classInfo.teacherIds) ? classInfo.teacherIds : (
      classInfo.teacherId ? [classInfo.teacherId] : []
    ),
    shift: classInfo.shift || null,
    grade: classInfo.grade || student.grade || '—',
    schedule: Array.isArray(classInfo.schedule) ? classInfo.schedule : [],
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'classes', classId), { studentsCount: increment(1) });
  return true;
}

/**
 * Place a student into every classroom matching مرحلة + شعبة + دوام
 * from admin registration. Returns how many new enrollments were added.
 */
export async function enrollStudentInMatchingClasses(student) {
  if (!student?.id) return { enrolled: 0, matched: 0 };
  const snap = await getDocs(query(classesCol, orderBy('createdAt', 'desc')));
  const classes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const matched = filterClassesForStudent(classes, student);
  let enrolled = 0;
  for (const cls of matched) {
    const added = await enrollStudent(cls.id, cls, student);
    if (added) enrolled += 1;
  }
  return {
    enrolled,
    matched: matched.length,
    classes: matched.map((c) => ({
      id: c.id,
      title: c.title,
      subject: c.subject,
      grade: c.grade,
      classSection: c.classSection || null,
      shift: c.shift || null,
    })),
  };
}

/**
 * When a new classroom is created, pull in active students already registered
 * for that مرحلة/شعبة/دوام.
 */
export async function enrollMatchingStudentsIntoClass(classId, classInfo) {
  const snap = await getDocs(collection(db, 'students'));
  const students = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const matched = filterStudentsForClass(students, { id: classId, ...classInfo });
  let enrolled = 0;
  for (const student of matched) {
    const added = await enrollStudent(classId, { id: classId, ...classInfo }, student);
    if (added) enrolled += 1;
  }
  return { enrolled, matched: matched.length };
}

/**
 * Re-sync enrollments after stage/section/shift change:
 * add newly matching classes; drop classes that matched the old placement
 * but no longer match (keeps unrelated manual enrollments if they never matched either).
 */
export async function syncStudentClassPlacement(student, previousStudent = null) {
  if (!student?.id) return { enrolled: 0, removed: 0 };

  const classesSnap = await getDocs(query(classesCol, orderBy('createdAt', 'desc')));
  const classes = classesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const shouldBe = new Set(filterClassesForStudent(classes, student).map((c) => c.id));

  let removed = 0;
  if (previousStudent) {
    const previouslyMatched = new Set(
      filterClassesForStudent(classes, previousStudent).map((c) => c.id),
    );
    for (const classId of previouslyMatched) {
      if (!shouldBe.has(classId)) {
        await unenrollStudent(classId, student.id);
        removed += 1;
      }
    }
  }

  let enrolled = 0;
  for (const cls of classes) {
    if (!shouldBe.has(cls.id)) continue;
    const added = await enrollStudent(cls.id, cls, student);
    if (added) enrolled += 1;
  }
  return { enrolled, removed, matched: shouldBe.size };
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
