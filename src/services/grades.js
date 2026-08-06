import { addDoc, collection, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { logActivity } from './activity';
import { createNotification } from './notifications';
import { assertTermOpen, fetchAcademicCalendar } from './academicCalendar';

export const gradeEntriesCol = collection(db, 'gradeEntries');

export function scoreToBand(score, maxScore) {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  if (pct >= 90) return 'ممتاز';
  if (pct >= 80) return 'جيد جداً';
  if (pct >= 70) return 'جيد';
  if (pct >= 60) return 'مقبول';
  return 'ضعيف';
}

/** Continuous classroom marks (دفتر / حضور / نشاط) + exam types. */
export const CONTINUOUS_TYPES = ['دفتر', 'حضور', 'نشاط'];

export const EXAM_TYPES = ['اختبار شهري', 'نصف فصل', 'نهاية فصل', 'فرض صفّي'];

/** Teacher submits a grade for one student — always lands as "قيد المراجعة"
 * until an admin approves it. */
export const ASSESSMENT_TYPES = [...CONTINUOUS_TYPES, ...EXAM_TYPES, 'أخرى'];

/** Suggested max score by type (teacher can still change). */
export const DEFAULT_MAX_BY_TYPE = {
  دفتر: 10,
  حضور: 10,
  نشاط: 10,
  'فرض صفّي': 20,
  'اختبار شهري': 100,
  'نصف فصل': 100,
  'نهاية فصل': 100,
  أخرى: 100,
};

export function defaultMaxForType(type) {
  return DEFAULT_MAX_BY_TYPE[type] ?? 100;
}

export function isContinuousType(type) {
  return CONTINUOUS_TYPES.includes(type);
}

export function assessmentTypeLabel(type) {
  if (type === 'دفتر') return 'درجة الدفتر';
  if (type === 'حضور') return 'درجة الحضور';
  if (type === 'نشاط') return 'درجة النشاط';
  return type || 'تقييم';
}

export async function submitGrade({
  classId, className, subject, studentId, studentName, teacherId, teacherName,
  assessmentTitle, score, maxScore, term, assessmentType,
}) {
  await assertTermOpen(term);
  const cal = await fetchAcademicCalendar();
  const ref = await addDoc(gradeEntriesCol, {
    classId, className, subject, studentId, studentName, teacherId, teacherName,
    assessmentTitle,
    assessmentType: assessmentType || '',
    score: Number(score),
    maxScore: Number(maxScore),
    term: term || '',
    academicYear: cal.academicYear || '',
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
  if (entry.teacherId) {
    await createNotification({
      userId: entry.teacherId,
      role: 'teacher',
      type: 'grade_approved',
      title: 'اعتُمدت درجة',
      body: `«${entry.assessmentTitle}» لـ ${entry.studentName} — ${entry.score}/${entry.maxScore}`,
      studentId: entry.studentId,
      studentName: entry.studentName,
      classId: entry.classId,
      link: `/teacher/students/${entry.studentId}`,
    });
  }
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
  if (entry.teacherId) {
    await createNotification({
      userId: entry.teacherId,
      role: 'teacher',
      type: 'grade_rejected',
      title: 'رُفضت درجة',
      body: `«${entry.assessmentTitle}» لـ ${entry.studentName} — راجع الرصد أو عدّله.`,
      studentId: entry.studentId,
      studentName: entry.studentName,
      classId: entry.classId,
      link: `/teacher/grades?class=${entry.classId || ''}`,
    });
  }
}
