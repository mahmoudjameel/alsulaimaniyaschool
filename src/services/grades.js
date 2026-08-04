import { addDoc, collection, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { logActivity } from './activity';

export const gradeEntriesCol = collection(db, 'gradeEntries');

export function scoreToBand(score, maxScore) {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  if (pct >= 90) return 'ممتاز';
  if (pct >= 80) return 'جيد جداً';
  if (pct >= 70) return 'جيد';
  if (pct >= 60) return 'مقبول';
  return 'ضعيف';
}

/** Teacher submits a grade for one student — always lands as "قيد المراجعة"
 * (enforced by firestore.rules too) until an admin approves it. */
export const ASSESSMENT_TYPES = ['اختبار شهري', 'نصف فصل', 'نهاية فصل', 'فرض صفّي', 'أخرى'];

export async function submitGrade({
  classId, className, subject, studentId, studentName, teacherId, teacherName,
  assessmentTitle, score, maxScore, term, assessmentType,
}) {
  const ref = await addDoc(gradeEntriesCol, {
    classId, className, subject, studentId, studentName, teacherId, teacherName,
    assessmentTitle,
    assessmentType: assessmentType || '',
    score: Number(score),
    maxScore: Number(maxScore),
    term: term || '',
    status: 'قيد المراجعة',
    createdAt: serverTimestamp(),
  });
  await logActivity({
    type: 'grade_submitted', actorUid: teacherId, actorName: teacherName, actorRole: 'teacher',
    summary: `رصد درجة «${assessmentTitle}» لـ ${studentName} — ${subject}`,
    targetType: 'gradeEntry', targetId: ref.id,
  });
  return ref.id;
}

/** Admin (or a delegated "grades.approve" permission) approves a pending
 * grade — this is the moment it becomes visible on the student's record. */
export async function approveGrade(entry, decidedBy) {
  await updateDoc(doc(db, 'gradeEntries', entry.id), {
    status: 'معتمد', decidedAt: serverTimestamp(), decidedBy: decidedBy.uid,
  });
  await setDoc(doc(db, 'students', entry.studentId, 'classes', entry.classId), {
    subject: entry.subject, title: entry.className, teacher: entry.teacherName, teacherId: entry.teacherId || null,
    grade: scoreToBand(entry.score, entry.maxScore),
  }, { merge: true });
  await logActivity({
    type: 'grade_approved', actorUid: decidedBy.uid, actorName: decidedBy.name, actorRole: decidedBy.role,
    summary: `اعتماد درجة «${entry.assessmentTitle}» لـ ${entry.studentName}`,
    targetType: 'gradeEntry', targetId: entry.id,
  });
}

export async function rejectGrade(entry, decidedBy) {
  await updateDoc(doc(db, 'gradeEntries', entry.id), {
    status: 'مرفوض', decidedAt: serverTimestamp(), decidedBy: decidedBy.uid,
  });
  await logActivity({
    type: 'grade_rejected', actorUid: decidedBy.uid, actorName: decidedBy.name, actorRole: decidedBy.role,
    summary: `رفض درجة «${entry.assessmentTitle}» لـ ${entry.studentName}`,
    targetType: 'gradeEntry', targetId: entry.id,
  });
}
