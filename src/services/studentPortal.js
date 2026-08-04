import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { logActivity } from './activity';

/** Resolve teacher-authored `correct` (index or text) to comparable answer text. */
export function resolveCorrectAnswer(q) {
  if (!q || q.correct == null) return String(q?.correctOption ?? '').trim();
  const opts = Array.isArray(q.options)
    ? q.options.map((o) => (typeof o === 'string' ? o : (o?.label || o?.text || String(o))))
    : [];
  if (typeof q.correct === 'number' && opts[q.correct] != null) {
    return String(opts[q.correct]).trim();
  }
  const raw = String(q.correct).trim();
  if (/^\d+$/.test(raw) && opts[Number(raw)] != null) {
    return String(opts[Number(raw)]).trim();
  }
  return raw;
}

/** Normalize questions so `correct` is always the option text (for student scoring). */
export function normalizeQuizQuestions(questions = []) {
  return questions.map((q) => {
    const type = q.type || 'mcq';
    if (type !== 'mcq' && type !== 'tf') return { ...q };
    return { ...q, correct: resolveCorrectAnswer(q) };
  });
}

/**
 * Auto-score objective questions; short/match/order counted as unscored.
 */
export function scoreQuizAttempt(quiz, answersByQuestionId) {
  const questions = quiz?.questions || [];
  let correct = 0;
  let autoGraded = 0;
  const details = [];

  for (const q of questions) {
    const qid = q.id || q.prompt;
    const given = answersByQuestionId[qid];
    const type = q.type || 'mcq';
    if (type === 'mcq' || type === 'tf') {
      autoGraded += 1;
      const givenText = String(given ?? '').trim();
      const correctText = resolveCorrectAnswer(q);
      const isCorrect = !!givenText && !!correctText && givenText === correctText;
      if (isCorrect) correct += 1;
      details.push({ questionId: qid, correct: isCorrect, given, expected: correctText || null });
    } else {
      details.push({ questionId: qid, correct: null, given, needsReview: true });
    }
  }

  const maxAuto = autoGraded || questions.length;
  return {
    score: correct,
    maxScore: maxAuto,
    autoGraded,
    correct,
    details,
    percent: autoGraded ? Math.round((correct / autoGraded) * 100) : null,
  };
}

export async function submitQuizAttempt({
  quiz, classId, className, studentId, studentName, studentUid, answers,
}) {
  const grading = scoreQuizAttempt(quiz, answers);
  const ref = await addDoc(collection(db, 'quizAttempts'), {
    quizId: quiz.id,
    quizTitle: quiz.title || 'اختبار',
    classId,
    className: className || '',
    teacherId: quiz.authorId || null,
    studentId,
    studentName: studentName || '',
    studentUid,
    answers,
    score: grading.score,
    maxScore: grading.maxScore,
    percent: grading.percent,
    autoGraded: grading.autoGraded,
    details: grading.details,
    status: 'مُسلَّم',
    submittedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  });

  await logActivity({
    type: 'quiz_submitted',
    actorUid: studentUid,
    actorName: studentName,
    actorRole: 'student',
    summary: `تسليم اختبار «${quiz.title || 'اختبار'}» — ${studentName}`,
    targetType: 'quizAttempt',
    targetId: ref.id,
  });

  return { id: ref.id, ...grading };
}

/** Detect homework-like lessons. */
export function isHomeworkLesson(lesson) {
  if (!lesson) return false;
  if (lesson.isHomework || lesson.type === 'واجب' || lesson.kind === 'homework') return true;
  const title = `${lesson.title || ''} ${lesson.chapterTitle || ''}`;
  if (/واجب|مهمة|homework|task/i.test(title)) return true;
  return (lesson.blocks || []).some((b) => b.kind === 'homework' || b.kind === 'task' || b.type === 'homework');
}

/** Render lesson blocks for the student view (matches Builder kinds). */
export function formatLessonBody(lesson) {
  if (!lesson) return '';
  const parts = [];
  for (const b of lesson.blocks || []) {
    const kind = b.kind || b.type;
    if (kind === 'title' && (b.text || b.content)) parts.push(b.text || b.content);
    else if ((kind === 'text' || kind === 'paragraph') && (b.text || b.content)) parts.push(b.text || b.content);
    else if (kind === 'list') {
      const items = b.items || String(b.text || '').split('\n').filter(Boolean);
      if (items.length) parts.push(items.map((it) => `• ${it}`).join('\n'));
    } else if (b.text || b.content) parts.push(b.text || b.content);
  }
  return parts.filter(Boolean).join('\n\n') || lesson.summary || lesson.whatTaught || '';
}
