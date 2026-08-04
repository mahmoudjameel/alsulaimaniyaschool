import { addDoc, collection, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { addStudentNote } from './students';

export const observationsCol = collection(db, 'observations');

export const teacherObservationsQuery = (teacherId) => query(
  observationsCol,
  where('teacherId', '==', teacherId),
  orderBy('createdAt', 'desc'),
);

/**
 * Writes a teacher observation to the top-level feed AND mirrors it onto
 * the student's notes subcollection (for the student profile / parent view).
 */
export async function createObservation({
  studentId, studentName, classId, className,
  teacherId, teacherName, kind, sentiment, note, visibleToParent, visibleToStudent = true,
  scenarioId,
}) {
  const payload = {
    studentId,
    studentName: studentName || '',
    classId: classId || null,
    className: className || null,
    teacherId,
    teacherName: teacherName || '',
    kind,
    sentiment,
    note,
    scenarioId: scenarioId || null,
    visibleToParent: !!visibleToParent,
    visibleToStudent: visibleToStudent !== false,
    createdAt: serverTimestamp(),
  };
  const ref = await addDoc(observationsCol, payload);
  await addStudentNote(studentId, {
    kind, sentiment, note,
    scenarioId: scenarioId || null,
    visibleToParent: !!visibleToParent,
    visibleToStudent: visibleToStudent !== false,
    by: teacherName || 'معلّم',
    authorId: teacherId,
    classId: classId || null,
    className: className || null,
  });
  return ref.id;
}
