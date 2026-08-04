import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { orderBy, where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { ErrorBanner, Field } from '../../components/ui';
import { useMyClasses } from '../../hooks/useMyClasses';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { demoEnrollments, demoQuizPreview, demoQuizTypes } from '../../data/demo';
import { deleteQuiz, saveQuiz } from '../../services/academics';
import { normalizeQuizQuestions, resolveCorrectAnswer } from '../../services/studentPortal';
import { relativeFromTimestamp } from '../../lib/relativeTime';

const TYPE_PROMPTS = {
  'اختيار من متعدد': { type: 'mcq', prompt: 'سؤال اختيار من متعدّد', options: ['خيار أ', 'خيار ب', 'خيار ج', 'خيار د'], correct: 0 },
  'صح / خطأ': { type: 'tf', prompt: 'عبارة صح أو خطأ', options: ['صح', 'خطأ'], correct: 0 },
  'إجابة قصيرة': { type: 'short', prompt: 'أجب بإيجاز…', options: [], correct: null },
  'مطابقة بالسحب': { type: 'match', prompt: 'طابق العناصر', options: ['أ→1', 'ب→2'], correct: null },
  'ترتيب': { type: 'order', prompt: 'رتّب الخطوات', options: ['خطوة 1', 'خطوة 2', 'خطوة 3'], correct: null },
  'فراغات': { type: 'blank', prompt: 'أكمل الفراغ…', options: [], correct: null },
};

function correctIndex(q) {
  const opts = q.options || [];
  if (typeof q.correct === 'number') return q.correct;
  const idx = opts.indexOf(q.correct);
  return idx >= 0 ? idx : 0;
}

export default function Quiz() {
  const [params] = useSearchParams();
  const { myClasses, profile, demo, error } = useMyClasses();
  const [classId, setClassId] = useState(params.get('class') || '');
  const activeClassId = classId || myClasses[0]?.id || '';
  const activeClass = myClasses.find((c) => c.id === activeClassId);

  const { data: liveQuizzes } = useLiveOrDemo(
    activeClassId ? `classes/${activeClassId}/quizzes` : '__none__',
    [orderBy('createdAt', 'desc')],
    [],
    activeClassId,
  );
  const { data: enrolled } = useLiveOrDemo(
    activeClassId ? `classes/${activeClassId}/enrollments` : '__none__',
    [orderBy('enrolledAt', 'asc')],
    demoEnrollments[activeClassId] || [],
  );
  const { data: attemptsRaw } = useLiveOrDemo(
    'quizAttempts',
    [where('classId', '==', activeClassId || '__none__')],
    [],
    activeClassId || '__none__',
  );

  const [localQuizzes, setLocalQuizzes] = useState([]);
  const quizzes = demo ? (localQuizzes.length ? localQuizzes : liveQuizzes) : liveQuizzes;

  const [quizId, setQuizId] = useState(null);
  const [title, setTitle] = useState('اختبار جديد');
  const [attempts, setAttempts] = useState(2);
  const [passMark, setPassMark] = useState(60);
  const [shuffle, setShuffle] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const classAttempts = useMemo(() => {
    const list = [...(attemptsRaw || [])];
    list.sort((a, b) => (b.submittedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0)
      - (a.submittedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0));
    return list;
  }, [attemptsRaw]);

  const quizAttempts = useMemo(
    () => (quizId ? classAttempts.filter((a) => a.quizId === quizId) : classAttempts.slice(0, 12)),
    [classAttempts, quizId],
  );

  useEffect(() => {
    if (params.get('class')) setClassId(params.get('class'));
  }, [params]);

  useEffect(() => {
    setQuizId(null);
    setTitle('اختبار جديد');
    setQuestions([]);
    setLocalQuizzes([]);
    setMessage('');
  }, [activeClassId]);

  const loadQuiz = (q) => {
    setQuizId(q.id);
    setTitle(q.title || 'اختبار');
    setAttempts(q.attempts ?? 2);
    setPassMark(q.passMark ?? 60);
    setShuffle(q.shuffle !== false);
    setQuestions(q.questions || []);
    setMessage('');
  };

  const startNew = () => {
    setQuizId(null);
    setTitle(`اختبار — ${activeClass?.subject || 'المساق'}`);
    setQuestions([]);
    setMessage('');
  };

  const addQuestion = (label) => {
    const def = TYPE_PROMPTS[label] || TYPE_PROMPTS['إجابة قصيرة'];
    setQuestions((q) => [...q, { id: `q-${Date.now()}-${q.length}`, ...def, label }]);
  };

  const updateQuestion = (id, patch) => {
    setQuestions((list) => list.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  };

  const removeQuestion = (id) => setQuestions((list) => list.filter((q) => q.id !== id));

  const persist = async (status = 'مسودة') => {
    if (!activeClass) return;
    if (!title.trim()) { setMessage('أدخل عنوان الاختبار.'); return; }
    const normalized = normalizeQuizQuestions(questions);
    const patch = {
      title: title.trim(),
      status,
      attempts: Number(attempts) || 1,
      passMark: Number(passMark) || 60,
      shuffle: !!shuffle,
      revealAnswers: 'after_submit',
      questions: normalized,
      authorId: profile?.id || null,
      authorName: profile?.name || '',
    };
    setSaving(true);
    setMessage('');
    try {
      if (demo) {
        const id = quizId || `demo-quiz-${Date.now()}`;
        const saved = { ...patch, id };
        setLocalQuizzes((list) => {
          const base = list.length ? list : liveQuizzes;
          const exists = base.some((q) => q.id === id);
          return exists ? base.map((q) => (q.id === id ? saved : q)) : [saved, ...base];
        });
        setQuizId(id);
        setQuestions(normalized);
        setMessage(status === 'منشور' ? 'نُشر الاختبار (عرض توضيحي).' : 'حُفظ الاختبار (عرض توضيحي).');
      } else {
        const id = await saveQuiz(activeClassId, quizId, patch);
        setQuizId(id);
        setQuestions(normalized);
        setMessage(status === 'منشور' ? 'نُشر الاختبار للطلاب المسجّلين في المساق.' : 'حُفظت مسودة الاختبار.');
      }
    } catch {
      setMessage('تعذّر حفظ الاختبار.');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!quizId) return;
    if (!window.confirm('حذف هذا الاختبار؟')) return;
    try {
      if (demo) {
        setLocalQuizzes((list) => (list.length ? list : liveQuizzes).filter((q) => q.id !== quizId));
      } else {
        await deleteQuiz(activeClassId, quizId);
      }
      startNew();
      setMessage('حُذف الاختبار.');
    } catch {
      setMessage('تعذّر الحذف.');
    }
  };

  const preview = questions[0] || {
    prompt: demoQuizPreview.q,
    options: demoQuizPreview.opts.map((o) => o.t),
    correct: demoQuizPreview.opts.findIndex((o) => o.correct),
  };
  const previewCorrect = typeof preview.correct === 'number'
    ? preview.correct
    : (preview.options || []).indexOf(resolveCorrectAnswer(preview));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ErrorBanner>{error && 'تعذّر تحميل صفوفك.'}</ErrorBanner>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <Field label="المساق">
          <select className="input" style={{ minWidth: 260 }} value={activeClassId} onChange={(e) => setClassId(e.target.value)}>
            {myClasses.map((c) => <option key={c.id} value={c.id}>{c.title} — {c.subject}</option>)}
          </select>
        </Field>
        <span style={{ marginInlineStart: 'auto' }} />
        <button type="button" className="btn btn-primary" style={{ fontSize: 13 }} onClick={startNew}>
          <Icon name="add" size={14} /> اختبار جديد
        </button>
      </div>
      {message && <div style={{ fontSize: 13, color: 'var(--color-accent-700)' }}>{message}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1.2fr 1fr', gap: 16, alignItems: 'start' }} className="ah-2col">
        <div className="card">
          <div className="card-kicker">اختبارات المساق</div>
          {quizzes.length === 0 && <div style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>لا اختبارات بعد.</div>}
          {quizzes.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => loadQuiz(q)}
              style={{
                display: 'block', width: '100%', textAlign: 'right', padding: '8px 10px', marginBottom: 6,
                border: `1px solid ${quizId === q.id ? 'var(--gold)' : 'var(--line)'}`,
                borderRadius: 'var(--radius-sm)', background: 'transparent', cursor: 'pointer', fontSize: 13,
              }}
            >
              <div style={{ fontWeight: 600 }}>{q.title}</div>
              <div style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>
                {(q.questions || []).length} سؤال · {q.status || 'مسودة'}
                {' · '}
                {classAttempts.filter((a) => a.quizId === q.id).length} تسليم
              </div>
            </button>
          ))}
          <hr className="hr" />
          <div className="card-kicker">الطلاب ({enrolled.length})</div>
          {enrolled.slice(0, 8).map((s) => (
            <div key={s.studentId || s.id} style={{ fontSize: 12, padding: '3px 0' }}>{s.studentName || s.name}</div>
          ))}
          {enrolled.length > 8 && <div style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>+{enrolled.length - 8} آخرون</div>}
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 8 }}>تأليف الاختبار</div>
          <Field label="عنوان الاختبار">
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 10 }}>
            <Field label="محاولات"><input className="input" type="number" min="1" value={attempts} onChange={(e) => setAttempts(e.target.value)} dir="ltr" style={{ textAlign: 'right' }} /></Field>
            <Field label="علامة النجاح %"><input className="input" type="number" min="0" max="100" value={passMark} onChange={(e) => setPassMark(e.target.value)} dir="ltr" style={{ textAlign: 'right' }} /></Field>
            <Field label="خلط الأسئلة">
              <select className="input" value={shuffle ? 'yes' : 'no'} onChange={(e) => setShuffle(e.target.value === 'yes')}>
                <option value="yes">نعم</option><option value="no">لا</option>
              </select>
            </Field>
          </div>

          <div style={{ marginTop: 14, marginBottom: 8, fontSize: 13, fontWeight: 600 }}>أنواع الأسئلة</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {demoQuizTypes.map((q) => (
              <button key={q.label} type="button" onClick={() => addQuestion(q.label)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: 'transparent', textAlign: 'right' }}>
                <Icon name={q.icon} size={16} color="var(--gold)" />
                <span style={{ fontSize: 13 }}>{q.label}</span>
              </button>
            ))}
          </div>

          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {questions.length === 0 && <div style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>أضف أسئلة من الأنواع أعلاه.</div>}
            {questions.map((q, i) => (
              <div key={q.id} style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', padding: 12 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <span className="tag tag-neutral">{i + 1}. {q.label || q.type}</span>
                  <button type="button" className="btn btn-ghost" style={{ fontSize: 11, marginInlineStart: 'auto' }} onClick={() => removeQuestion(q.id)}>حذف</button>
                </div>
                <input className="input" value={q.prompt || ''} onChange={(e) => updateQuestion(q.id, { prompt: e.target.value })} placeholder="نص السؤال" />
                {(q.options || []).length > 0 && (
                  <>
                    <textarea
                      className="input"
                      style={{ marginTop: 8 }}
                      rows={Math.max(2, q.options.length)}
                      value={q.options.join('\n')}
                      onChange={(e) => updateQuestion(q.id, { options: e.target.value.split('\n') })}
                      placeholder="خيار في كل سطر"
                    />
                    <Field label="الإجابة الصحيحة">
                      <select
                        className="input"
                        value={correctIndex(q)}
                        onChange={(e) => updateQuestion(q.id, { correct: Number(e.target.value) })}
                      >
                        {(q.options || []).map((opt, oi) => (
                          <option key={`${q.id}-c-${oi}`} value={oi}>{opt || `خيار ${oi + 1}`}</option>
                        ))}
                      </select>
                    </Field>
                  </>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => persist('مسودة')}>حفظ مسودة</button>
            <button type="button" className="btn btn-primary" disabled={saving} onClick={() => persist('منشور')}>نشر للاختبار</button>
            {quizId && <button type="button" className="btn btn-ghost" onClick={onDelete}>حذف</button>}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <div className="card-kicker">معاينة الطالب</div>
            <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-neutral-500)', marginBottom: 10 }}>
                <span>سؤال 1 من {Math.max(questions.length, 1)}</span>
                <span className="ah-tabnum">محاولات: {attempts}</span>
              </div>
              <h4 style={{ margin: '0 0 12px' }}>{preview.prompt}</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(preview.options || []).map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: `1px solid ${i === previewCorrect ? 'var(--gold)' : 'var(--color-divider)'}`, borderRadius: 'var(--radius-md)', fontSize: 14 }}>
                    <span style={{ width: 16, height: 16, borderRadius: '50%', border: '1.5px solid var(--color-divider)', flex: 'none' }} />
                    <span>{t}</span>
                  </div>
                ))}
                {(preview.options || []).length === 0 && (
                  <input className="input" placeholder="إجابة الطالب…" disabled />
                )}
              </div>
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--color-neutral-600)' }}>
              يُربَط الاختبار بـ {enrolled.length} طالباً في مساق «{activeClass?.title || '—'}».
            </div>
          </div>

          <div className="card">
            <div className="card-title" style={{ marginBottom: 8, fontSize: 15 }}>
              {quizId ? 'تسليمات هذا الاختبار' : 'آخر التسليمات'}
            </div>
            {quizAttempts.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>
                لا تسليمات بعد — تظهر هنا عندما يحلّ الطلاب الاختبار من بوابتهم.
              </div>
            )}
            {quizAttempts.map((a) => (
              <div key={a.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)', fontSize: 13 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <strong>{a.studentName || 'طالب'}</strong>
                  <span className="tag tag-outline" style={{ fontSize: 10 }}>
                    {a.percent != null ? `${a.percent}%` : `${a.score ?? '—'}/${a.maxScore ?? '—'}`}
                  </span>
                  {(a.details || []).some((d) => d.needsReview) && (
                    <span className="tag tag-accent-2" style={{ fontSize: 10 }}>يحتاج مراجعة</span>
                  )}
                  <span style={{ marginInlineStart: 'auto', fontSize: 11, color: 'var(--color-neutral-500)' }}>
                    {relativeFromTimestamp(a.submittedAt || a.createdAt)}
                  </span>
                </div>
                {!quizId && a.quizTitle && (
                  <div style={{ fontSize: 11, color: 'var(--color-neutral-500)', marginTop: 2 }}>{a.quizTitle}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
