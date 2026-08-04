import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { orderBy } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { ErrorBanner, SegmentedTabs } from '../../components/ui';
import { useMyClasses } from '../../hooks/useMyClasses';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { demoBuilderChapters, demoEnrollments } from '../../data/demo';
import { deleteLesson, saveLesson } from '../../services/academics';
import { saveDayLog } from '../../services/dayLog';

const STATUS_TONE = { 'قيد التحرير': 'outline', منشور: 'accent', مجدول: 'neutral' };

const LIST_FILTERS = [
  { id: 'all', label: 'الكل' },
  { id: 'منشور', label: 'منشور' },
  { id: 'قيد التحرير', label: 'مسودة' },
];

function emptyLesson(order = 0) {
  return {
    id: null,
    title: '',
    chapterTitle: '',
    order,
    status: 'قيد التحرير',
    scheduledFor: new Date().toISOString().slice(0, 10),
    body: '',
    pointsText: '',
    whatTaught: '',
    notes: '',
    isHomework: false,
    dueDate: '',
    syncDiary: true,
  };
}

/** Flatten stored blocks into simple editor fields. */
function draftFromLesson(lesson) {
  const blocks = Array.isArray(lesson.blocks) ? lesson.blocks : [];
  const titleBlock = blocks.find((b) => b.kind === 'title');
  const textParts = blocks.filter((b) => b.kind === 'text' || b.kind === 'paragraph').map((b) => b.text || b.content || '');
  const listBlock = blocks.find((b) => b.kind === 'list');
  const points = listBlock?.items || (listBlock?.text ? String(listBlock.text).split('\n') : []);
  return {
    id: lesson.id || null,
    title: lesson.title || titleBlock?.text || '',
    chapterTitle: lesson.chapterTitle || '',
    order: lesson.order ?? 0,
    status: lesson.status || 'قيد التحرير',
    scheduledFor: lesson.scheduledFor || '',
    body: lesson.body || textParts.join('\n\n') || '',
    pointsText: (points || []).join('\n'),
    whatTaught: lesson.whatTaught || '',
    notes: lesson.notes || '',
    isHomework: !!lesson.isHomework,
    dueDate: lesson.dueDate || '',
    syncDiary: true,
  };
}

function blocksFromDraft(draft) {
  const blocks = [];
  if ((draft.title || '').trim()) blocks.push({ kind: 'title', text: draft.title.trim() });
  if ((draft.body || '').trim()) blocks.push({ kind: 'text', text: draft.body.trim() });
  const points = String(draft.pointsText || '').split('\n').map((s) => s.trim()).filter(Boolean);
  if (points.length) blocks.push({ kind: 'list', items: points });
  return blocks;
}

export default function Builder() {
  const [params] = useSearchParams();
  const { myClasses, profile, demo, error } = useMyClasses();
  const [classId, setClassId] = useState(params.get('class') || '');
  const activeClassId = classId || myClasses[0]?.id || '';
  const activeClass = myClasses.find((c) => c.id === activeClassId);
  const [listFilter, setListFilter] = useState('all');

  const demoLessons = useMemo(() => {
    const list = [];
    let order = 0;
    demoBuilderChapters.forEach((ch) => {
      ch.lessons.forEach((l) => {
        list.push({
          id: `demo-${order}`,
          title: l.t,
          chapterTitle: ch.title,
          order: order++,
          status: l.state,
          scheduledFor: null,
          blocks: [
            { kind: 'title', text: l.t },
            { kind: 'text', text: 'محتوى الدرس التوضيحي للطالب…' },
          ],
          whatTaught: 'شرح الدرس مع أمثلة صفّية',
          notes: '',
          isHomework: l.state === 'منشور',
        });
      });
    });
    return list;
  }, []);

  const { data: liveLessons } = useLiveOrDemo(
    activeClassId ? `classes/${activeClassId}/lessons` : '__none__',
    [orderBy('order', 'asc')],
    demoLessons,
    activeClassId,
  );

  const { data: enrolled } = useLiveOrDemo(
    activeClassId ? `classes/${activeClassId}/enrollments` : '__none__',
    [orderBy('enrolledAt', 'asc')],
    demoEnrollments[activeClassId] || [],
  );

  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [localLessons, setLocalLessons] = useState([]);

  const lessons = demo ? (localLessons.length ? localLessons : liveLessons) : liveLessons;
  const filteredLessons = useMemo(() => {
    if (listFilter === 'all') return lessons;
    return lessons.filter((l) => l.status === listFilter);
  }, [lessons, listFilter]);

  useEffect(() => {
    if (params.get('class')) setClassId(params.get('class'));
  }, [params]);

  useEffect(() => {
    setSelectedId(null);
    setDraft(null);
    setLocalLessons([]);
    setMessage('');
  }, [activeClassId]);

  const selectLesson = (lesson) => {
    setSelectedId(lesson.id);
    setDraft(draftFromLesson(lesson));
    setMessage('');
  };

  const startNew = () => {
    setSelectedId(null);
    setDraft(emptyLesson(lessons.length));
    setMessage('');
  };

  const persist = async (statusOverride) => {
    if (!draft || !activeClass) return;
    if (!(draft.title || '').trim()) {
      setMessage('أدخل عنوان الدرس أولاً.');
      return;
    }
    const status = statusOverride || draft.status || 'قيد التحرير';
    const blocks = blocksFromDraft(draft);
    const patch = {
      title: draft.title.trim(),
      chapterTitle: (draft.chapterTitle || '').trim() || 'وحدة عامة',
      order: typeof draft.order === 'number' ? draft.order : lessons.length,
      status,
      scheduledFor: draft.scheduledFor || null,
      blocks,
      body: (draft.body || '').trim(),
      whatTaught: (draft.whatTaught || '').trim(),
      notes: (draft.notes || '').trim(),
      isHomework: !!draft.isHomework,
      dueDate: draft.isHomework ? (draft.dueDate || null) : null,
      authorId: profile?.id || null,
      authorName: profile?.name || '',
      published: status === 'منشور',
    };
    setSaving(true);
    setMessage('');
    try {
      if (demo) {
        const id = draft.id || `demo-new-${Date.now()}`;
        const saved = { ...patch, id };
        setLocalLessons((list) => {
          const base = list.length ? list : liveLessons;
          const exists = base.some((l) => l.id === id);
          return exists ? base.map((l) => (l.id === id ? saved : l)) : [...base, saved];
        });
        setSelectedId(id);
        setDraft(draftFromLesson(saved));
        setMessage(status === 'منشور' ? 'نُشر الدرس للطلاب (عرض).' : 'حُفظت المسودة (عرض).');
      } else {
        const id = await saveLesson(activeClassId, draft.id || null, patch);
        if (status === 'منشور' && draft.syncDiary && draft.scheduledFor) {
          try {
            await saveDayLog({
              classId: activeClassId,
              className: activeClass.title,
              subject: activeClass.subject,
              teacherId: profile.id,
              teacherName: profile.name,
              date: draft.scheduledFor,
              topic: draft.whatTaught || draft.title,
              homework: draft.isHomework
                ? [(draft.dueDate ? `التسليم ${draft.dueDate}: ` : '') + (draft.notes || draft.title)].join('')
                : '',
              notice: '',
            });
          } catch {
            // Day log is best-effort; lesson already saved.
          }
        }
        setSelectedId(id);
        setDraft((d) => ({ ...d, ...draftFromLesson({ ...patch, id }), id }));
        setMessage(
          status === 'منشور'
            ? 'نُشر الدرس — يظهر للطالب والإدارة الآن.'
            : 'حُفظت المسودة (لا يراها الطالب حتى تنشرها).',
        );
      }
    } catch {
      setMessage('تعذّر حفظ الدرس. تأكد أن الصف مسند إليك.');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!draft?.id || !activeClassId) return;
    if (!window.confirm('حذف هذا الدرس؟ لن يظهر للطالب بعد الحذف.')) return;
    try {
      if (demo) {
        setLocalLessons((list) => (list.length ? list : liveLessons).filter((l) => l.id !== draft.id));
      } else {
        await deleteLesson(activeClassId, draft.id, { actorUid: profile?.id, actorName: profile?.name });
      }
      setDraft(null);
      setSelectedId(null);
      setMessage('حُذف الدرس.');
    } catch {
      setMessage('تعذّر الحذف.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ErrorBanner>{error && 'تعذّر تحميل صفوفك.'}</ErrorBanner>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)', lineHeight: 1.7 }}>
        اكتب درس الصف بخطوات بسيطة، ثم انشره ليظهر للطالب المسجّل وفي لوحة الإدارة.
        المسودة تبقى خاصة بك حتى تضغط «نشر للطلاب».
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
        <div className="field" style={{ minWidth: 240, flex: 1 }}>
          <label>الصف</label>
          <select className="input" value={activeClassId} onChange={(e) => setClassId(e.target.value)}>
            {myClasses.length === 0 && <option value="">لا صفوف مسندة</option>}
            {myClasses.map((c) => (
              <option key={c.id} value={c.id}>{c.title} — {c.subject}{c.grade ? ` · ${c.grade}` : ''}</option>
            ))}
          </select>
        </div>
        <button type="button" className="btn btn-primary" onClick={startNew} disabled={!activeClass}>
          <Icon name="add" size={14} /> درس جديد
        </button>
        <Link to={`/teacher/diary?class=${activeClassId}`} className="btn btn-secondary" style={{ textDecoration: 'none', fontSize: 13 }}>
          دفتر اليوم
        </Link>
      </div>

      {message && <div style={{ fontSize: 13, color: 'var(--color-accent-700)' }}>{message}</div>}

      {!activeClass ? (
        <div className="card">لا صفوف مسندة إليك — اطلب من الإدارة تعيينك معلّماً لصف.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 280px) 1fr', gap: 16, alignItems: 'start' }} className="ah-2col">
          <aside className="card" style={{ gap: 10 }}>
            <div className="card-title" style={{ margin: 0, fontSize: 16 }}>دروس الصف</div>
            <div style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>
              {enrolled.length} طالب مسجّل · {lessons.length} درس
            </div>
            <SegmentedTabs
              tabs={LIST_FILTERS.map((f) => ({
                ...f,
                active: listFilter === f.id,
                onClick: () => setListFilter(f.id),
              }))}
            />
            {filteredLessons.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>لا دروس في هذه الفئة.</div>
            )}
            {filteredLessons.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => selectLesson(l)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'right',
                  padding: '10px 12px',
                  border: `1px solid ${selectedId === l.id ? 'var(--gold)' : 'var(--line)'}`,
                  borderRadius: 10,
                  background: selectedId === l.id ? 'color-mix(in srgb, var(--color-accent-100) 65%, #fff)' : '#fff',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13 }}>{l.title || 'بدون عنوان'}</div>
                <div style={{ fontSize: 11, color: 'var(--color-neutral-500)', marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span className={`tag tag-${STATUS_TONE[l.status] || 'neutral'}`} style={{ fontSize: 9 }}>
                    {l.status === 'قيد التحرير' ? 'مسودة' : l.status}
                  </span>
                  {l.isHomework && <span className="tag tag-accent" style={{ fontSize: 9 }}>واجب</span>}
                  {l.scheduledFor && <span>{l.scheduledFor}</span>}
                </div>
              </button>
            ))}
          </aside>

          <section className="card" style={{ gap: 14 }}>
            {!draft ? (
              <div style={{ color: 'var(--color-neutral-500)', fontSize: 14, lineHeight: 1.7 }}>
                اختر درساً من القائمة أو اضغط «درس جديد».
                <div style={{ marginTop: 10 }}>
                  <button type="button" className="btn btn-primary" onClick={startNew}>بدء درس جديد</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div className="card-title" style={{ margin: 0 }}>{draft.id ? 'تعديل الدرس' : 'درس جديد'}</div>
                  <span className={`tag tag-${STATUS_TONE[draft.status] || 'outline'}`}>
                    {draft.status === 'قيد التحرير' ? 'مسودة' : draft.status}
                  </span>
                </div>

                <div className="field">
                  <label>1) عنوان الدرس</label>
                  <input
                    className="input"
                    value={draft.title}
                    onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                    placeholder="مثال: المدّ بالألف — قراءة وتدريب"
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="field">
                    <label>الوحدة / الفصل</label>
                    <input
                      className="input"
                      value={draft.chapterTitle}
                      onChange={(e) => setDraft((d) => ({ ...d, chapterTitle: e.target.value }))}
                      placeholder="مثال: الوحدة 2"
                    />
                  </div>
                  <div className="field">
                    <label>تاريخ الحصة</label>
                    <input
                      className="input"
                      type="date"
                      value={draft.scheduledFor || ''}
                      onChange={(e) => setDraft((d) => ({ ...d, scheduledFor: e.target.value }))}
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="field">
                  <label>2) ماذا أُعطي في الحصة؟ (ملخّص سريع)</label>
                  <textarea
                    className="input"
                    rows={2}
                    value={draft.whatTaught}
                    onChange={(e) => setDraft((d) => ({ ...d, whatTaught: e.target.value }))}
                    placeholder="مثال: شرح المدّ + قراءة جهرية + تمارين السبورة"
                    style={{ resize: 'vertical' }}
                  />
                </div>

                <div className="field">
                  <label>3) محتوى يظهر للطالب بعد النشر</label>
                  <textarea
                    className="input"
                    rows={5}
                    value={draft.body}
                    onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                    placeholder="اكتب شرح الدرس أو الملخص الذي سيقرأه الطالب…"
                    style={{ resize: 'vertical' }}
                  />
                </div>

                <div className="field">
                  <label>نقاط مهمة (اختياري — بند في كل سطر)</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={draft.pointsText}
                    onChange={(e) => setDraft((d) => ({ ...d, pointsText: e.target.value }))}
                    placeholder={'مثال:\nمدّ الألف بعد الفتحة\nأمثلة من الكتاب ص. 24'}
                    style={{ resize: 'vertical' }}
                  />
                </div>

                <div style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 12, display: 'grid', gap: 10 }}>
                  <label className="radio" style={{ margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={!!draft.isHomework}
                      onChange={(e) => setDraft((d) => ({ ...d, isHomework: e.target.checked }))}
                    />
                    <span className="dot" /> هذا الدرس فيه واجب بيتي (يظهر في واجبات الطالب)
                  </label>
                  {draft.isHomework && (
                    <div className="field" style={{ margin: 0 }}>
                      <label>آخر موعد للتسليم</label>
                      <input
                        className="input"
                        type="date"
                        value={draft.dueDate || ''}
                        onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))}
                        dir="ltr"
                        style={{ maxWidth: 200 }}
                      />
                    </div>
                  )}
                  <div className="field" style={{ margin: 0 }}>
                    <label>تفاصيل الواجب / ملاحظة للطالب (اختياري)</label>
                    <textarea
                      className="input"
                      rows={2}
                      value={draft.notes}
                      onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                      placeholder="مثال: حل تمارين الصفحة 12 في الدفتر"
                      style={{ resize: 'vertical' }}
                    />
                  </div>
                  <label className="radio" style={{ margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={!!draft.syncDiary}
                      onChange={(e) => setDraft((d) => ({ ...d, syncDiary: e.target.checked }))}
                    />
                    <span className="dot" /> عند النشر: انسخ الملخص لدفتر اليوم بنفس التاريخ
                  </label>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => persist('قيد التحرير')}>
                    <Icon name="save" size={14} /> حفظ مسودة
                  </button>
                  <button type="button" className="btn btn-primary" disabled={saving} onClick={() => persist('منشور')}>
                    <Icon name="publish" size={14} /> نشر للطلاب
                  </button>
                  {draft.status === 'منشور' && (
                    <button type="button" className="btn btn-ghost" disabled={saving} onClick={() => persist('قيد التحرير')}>
                      إلغاء النشر
                    </button>
                  )}
                  {draft.id && (
                    <button type="button" className="btn btn-ghost" style={{ marginInlineStart: 'auto' }} onClick={onDelete}>
                      حذف
                    </button>
                  )}
                </div>

                <div style={{ fontSize: 12, color: 'var(--color-neutral-600)', lineHeight: 1.6, paddingTop: 4 }}>
                  بعد النشر: يظهر في بوابة الطالب (صفوفي){draft.isHomework ? ' وفي الواجبات' : ''}، وتراه الإدارة من تفاصيل الصف.
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
