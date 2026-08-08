import { useMemo, useState } from 'react';
import { orderBy, where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { ErrorBanner, Field } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { useMyStudent } from '../../hooks/useMyStudent';
import { submitQuizAttempt, formatLessonBody, resolveCorrectAnswer } from '../../services/studentPortal';
import { demoPublicClasses, demoStudentClasses } from '../../data/demo';

export default function StudentClasses() {
  const { profile } = useAuth();
  const { student, studentId, enrolled, demo, error: studentErr } = useMyStudent();
  const { data: allClasses, error: classErr } = useLiveOrDemo(
    'classes',
    [orderBy('createdAt', 'desc')],
    demoPublicClasses.map((c, i) => ({ id: `pub-${i}`, ...c })),
  );

  const list = useMemo(() => {
    if (demo) {
      return demoStudentClasses.map((c, i) => ({
        id: `demo-c-${i}`,
        title: c.title,
        subject: c.subject,
        progress: c.progress,
        nextLesson: c.next,
      }));
    }
    if (!studentId || !(enrolled || []).length) return [];
    return enrolled.map((e) => {
      const full = (allClasses || []).find((c) => c.id === e.id || c.id === e.classId);
      const schedule = Array.isArray(full?.schedule) ? full.schedule : [];
      return {
        id: e.classId || e.id,
        title: e.title || e.className || full?.title || 'صف',
        subject: e.subject || full?.subject || '',
        teacher: e.teacher || e.teacherName || full?.teacher || full?.teacherName || '',
        progress: e.progress,
        scheduleLabel: schedule.length
          ? schedule.map((s) => [
            s.day,
            s.start && s.end ? `${s.start}–${s.end}` : (s.start || ''),
            s.subject || '',
            s.teacherName || '',
          ].filter(Boolean).join(' ')).join(' · ')
          : '',
      };
    });
  }, [demo, studentId, enrolled, allClasses]);

  const [activeId, setActiveId] = useState(null);
  const [takingQuiz, setTakingQuiz] = useState(null);
  const active = list.find((c) => c.id === activeId) || null;

  const lessonPath = activeId ? `classes/${activeId}/lessons` : 'classes/__none__/lessons';
  const quizPath = activeId ? `classes/${activeId}/quizzes` : 'classes/__none__/quizzes';
  const { data: lessons } = useLiveOrDemo(lessonPath, [orderBy('order', 'asc')], demo && active ? [
    { id: 'l1', title: active.nextLesson || 'الدرس التالي', status: 'منشور', summary: 'اقرأ الملخص ثم راجع الأمثلة مع معلّمك.', blocks: [{ type: 'text', content: 'مرحباً بك في الدرس.' }] },
  ] : [], activeId || '__none__');
  const { data: quizzes } = useLiveOrDemo(quizPath, [orderBy('createdAt', 'desc')], demo && active ? [
    {
      id: 'q1', title: 'مراجعة سريعة', status: 'منشور',
      questions: [
        { id: 'qq1', type: 'mcq', prompt: 'ما موضوع الدرس؟', options: ['قراءة', 'رياضة', 'فن'], correct: 'قراءة' },
        { id: 'qq2', type: 'tf', prompt: 'المواظبة مهمة', options: ['صح', 'خطأ'], correct: 'صح' },
      ],
    },
  ] : [], activeId || '__none__');

  const { data: myAttempts } = useLiveOrDemo(
    'quizAttempts',
    [where('studentUid', '==', profile?.id || '__none__')],
    [],
    profile?.id || '__none__',
  );

  if (takingQuiz) {
    return (
      <QuizTaker
        quiz={takingQuiz.quiz}
        classId={takingQuiz.classId}
        className={takingQuiz.className}
        student={student}
        studentId={studentId}
        profile={profile}
        demo={demo}
        onBack={() => setTakingQuiz(null)}
      />
    );
  }

  if (active) {
    const publishedLessons = (lessons || []).filter((l) => !l.status || l.status === 'منشور' || l.published);
    const publishedQuizzes = (quizzes || []).filter((q) => !q.status || q.status === 'منشور');
    return (
      <div className="stu-page">
        <button type="button" className="btn btn-ghost" style={{ alignSelf: 'flex-start', fontSize: 13 }} onClick={() => setActiveId(null)}>
          <Icon name="arrow_forward" size={15} /> عودة للصفوف
        </button>
        <header className="stu-detail-head">
          {active.subject && <span className="tag tag-outline">{active.subject}</span>}
          <h1 className="stu-detail-title">{active.title}</h1>
          {active.teacher && <p className="stu-hello-sub" style={{ margin: 0 }}>المعلّم: {active.teacher}</p>}
        </header>

        <section className="card">
          <h2 className="card-title" style={{ marginBottom: 10 }}>الدروس المنشورة</h2>
          {publishedLessons.length === 0 && <p className="stu-empty">لا دروس منشورة بعد. ستظهر هنا عندما ينشر معلّمك درساً.</p>}
          {publishedLessons.map((l) => (
            <article key={l.id} className="stu-lesson">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
                {l.chapterTitle && <span className="tag tag-neutral">{l.chapterTitle}</span>}
                {l.scheduledFor && <span className="stu-class-meta">{l.scheduledFor}</span>}
                {l.isHomework && <span className="tag tag-accent">واجب</span>}
              </div>
              <h3 className="stu-lesson-title">{l.title || 'درس'}</h3>
              {l.whatTaught && (
                <div className="stu-class-meta" style={{ marginBottom: 8 }}>ملخّص الحصة: {l.whatTaught}</div>
              )}
              <div className="stu-lesson-body" style={{ whiteSpace: 'pre-wrap' }}>
                {formatLessonBody(l) || l.body || '—'}
              </div>
              {l.notes && l.isHomework && (
                <div style={{ marginTop: 8, fontSize: 13 }}>
                  <strong>الواجب:</strong> {l.notes}
                  {l.dueDate ? ` · التسليم: ${l.dueDate}` : ''}
                </div>
              )}
              {l.authorName && <div className="stu-class-meta" style={{ marginTop: 6 }}>المعلّم: {l.authorName}</div>}
            </article>
          ))}
        </section>

        <section className="card">
          <h2 className="card-title" style={{ marginBottom: 10 }}>الاختبارات</h2>
          {publishedQuizzes.length === 0 && <p className="stu-empty">لا اختبارات منشورة حالياً.</p>}
          {publishedQuizzes.map((q) => {
            const attempt = (myAttempts || []).find((a) => a.quizId === q.id);
            return (
              <div key={q.id} className="stu-lesson" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <h3 className="stu-lesson-title" style={{ margin: 0 }}>{q.title || 'اختبار'}</h3>
                  <div className="stu-class-meta">{(q.questions || []).length} أسئلة</div>
                  {attempt && (
                    <div className="stu-class-meta" style={{ color: 'var(--color-accent-700)' }}>
                      مُسلَّم{attempt.percent != null ? ` · ${attempt.percent}%` : attempt.score != null ? ` · ${attempt.score}/${attempt.maxScore}` : ''}
                    </div>
                  )}
                </div>
                {!attempt && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ fontSize: 13 }}
                    onClick={() => setTakingQuiz({ quiz: q, classId: activeId, className: active.title })}
                  >
                    <Icon name="edit" size={14} /> ابدأ الاختبار
                  </button>
                )}
                {attempt && <span className="tag tag-accent">تم التسليم</span>}
              </div>
            );
          })}
        </section>
      </div>
    );
  }

  return (
    <div className="stu-page">
      <ErrorBanner>{(studentErr || classErr) && 'تعذّر تحميل الصفوف.'}</ErrorBanner>
      <header className="stu-page-head">
        <h1 className="stu-page-title">صفوفي</h1>
        <p className="stu-page-lead">اختر صفاً لفتح الدروس والاختبارات</p>
      </header>
      {list.length === 0 && (
        <div className="stu-empty-block">
          <Icon name="menu_book" size={28} color="var(--gold)" />
          <p>ما في صفوف على حسابك بعد.</p>
        </div>
      )}
      <div className="stu-class-grid">
        {list.map((c) => (
          <button key={c.id || c.title} type="button" className="stu-class-card" onClick={() => setActiveId(c.id)}>
            <span className="tag tag-outline">{c.subject || 'عام'}</span>
            <span className="stu-class-card-title">{c.title}</span>
            <span className="stu-class-meta">{c.teacher || c.nextLesson || ''}</span>
            {c.scheduleLabel && <span className="stu-class-meta">{c.scheduleLabel}</span>}
            <span className="stu-class-cta"><Icon name="play_arrow" size={15} /> فتح</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function QuizTaker({ quiz, classId, className, student, studentId, profile, demo, onBack }) {
  const questions = quiz.questions || [];
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const setAnswer = (qid, value) => setAnswers((a) => ({ ...a, [qid]: value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      if (demo) {
        const auto = questions.filter((q) => q.type === 'mcq' || q.type === 'tf' || (!q.type && (q.options || []).length));
        const correct = auto.filter((q) => {
          const id = q.id || q.prompt;
          return String(answers[id] || '').trim() === resolveCorrectAnswer(q);
        }).length;
        const max = auto.length || questions.length;
        setResult({ score: correct, maxScore: max, percent: Math.round((correct / Math.max(1, max)) * 100) });
        return;
      }
      const res = await submitQuizAttempt({
        quiz,
        classId,
        className,
        studentId,
        studentName: student?.name || profile?.name,
        studentUid: profile?.id,
        answers,
      });
      setResult(res);
    } catch {
      setError('تعذّر تسليم الاختبار. حاول مجدداً.');
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="stu-page">
        <div className="card" style={{ textAlign: 'center', gap: 12, padding: 28 }}>
          <Icon name="check_circle" size={40} color="var(--gold)" />
          <h2 className="stu-page-title" style={{ fontSize: 24 }}>تم التسليم</h2>
          <p className="stu-page-lead">
            نتيجتك التقريبية:{' '}
            <strong className="ah-tabnum">
              {result.percent != null ? `${result.percent}%` : `${result.score}/${result.maxScore}`}
            </strong>
          </p>
          <p className="stu-class-meta">الأسئلة المقالية قد تحتاج مراجعة المعلّم.</p>
          <button type="button" className="btn btn-primary" onClick={onBack}>عودة للصف</button>
        </div>
      </div>
    );
  }

  return (
    <form className="stu-page" onSubmit={onSubmit}>
      <button type="button" className="btn btn-ghost" style={{ alignSelf: 'flex-start', fontSize: 13 }} onClick={onBack}>
        <Icon name="arrow_forward" size={15} /> إلغاء
      </button>
      <header className="stu-page-head">
        <h1 className="stu-page-title">{quiz.title || 'اختبار'}</h1>
        <p className="stu-page-lead">{questions.length} أسئلة — أجب ثم سلّم.</p>
      </header>
      {error && <ErrorBanner>{error}</ErrorBanner>}
      {questions.map((q, i) => {
        const qid = q.id || q.prompt || `q-${i}`;
        const opts = q.options || (q.type === 'tf' ? ['صح', 'خطأ'] : []);
        return (
          <div key={qid} className="card">
            <div className="stu-class-name" style={{ marginBottom: 10 }}>{i + 1}. {q.prompt || q.label || q.text}</div>
            {(q.type === 'short' || q.type === 'blank' || (!opts.length && q.type !== 'mcq' && q.type !== 'tf')) ? (
              <Field label="إجابتك">
                <input className="input" value={answers[qid] || ''} onChange={(e) => setAnswer(qid, e.target.value)} required />
              </Field>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {opts.map((opt) => {
                  const val = typeof opt === 'string' ? opt : (opt.label || opt.text || opt.id);
                  return (
                    <label key={val} className="radio" style={{ gap: 10 }}>
                      <input
                        type="radio"
                        name={qid}
                        checked={answers[qid] === val}
                        onChange={() => setAnswer(qid, val)}
                        required
                      />
                      <span className="dot" />
                      {val}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
        {submitting ? 'جارٍ التسليم…' : 'تسليم الإجابات'}
      </button>
    </form>
  );
}
