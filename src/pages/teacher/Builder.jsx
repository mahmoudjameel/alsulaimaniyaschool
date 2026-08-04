import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { orderBy } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { ErrorBanner, Field } from '../../components/ui';
import { useMyClasses } from '../../hooks/useMyClasses';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { blockPalette, demoBuilderChapters, demoEnrollments } from '../../data/demo';
import { deleteLesson, saveLesson } from '../../services/academics';

let uid = 0;
const nextId = () => `blk-${Date.now()}-${++uid}`;

const BLOCK_DEFAULTS = {
  title: { kind: 'title', text: 'عنوان جديد' },
  'نص منسّق': { kind: 'text', text: 'اكتب نصّ الدرس هنا…' },
  صورة: { kind: 'image', text: '' },
  قائمة: { kind: 'list', items: ['بند أول', 'بند ثانٍ'] },
  جدول: { kind: 'table', text: '' },
  مرفق: { kind: 'file', text: '' },
  تضمين: { kind: 'embed', text: '' },
  شريحة: { kind: 'slide', text: '' },
};

const STATUS_TONE = { 'قيد التحرير': 'outline', 'منشور': 'accent', 'مجدول': 'neutral' };

const emptyLesson = (order = 0) => ({
  id: null,
  title: 'درس جديد',
  chapterTitle: 'وحدة عامة',
  order,
  status: 'قيد التحرير',
  scheduledFor: new Date().toISOString().slice(0, 10),
  blocks: [{ id: nextId(), kind: 'title', text: 'عنوان الدرس' }],
  whatTaught: '',
  notes: '',
  isHomework: false,
  dueDate: '',
});

export default function Builder() {
  const [params] = useSearchParams();
  const { myClasses, profile, demo, error } = useMyClasses();
  const [classId, setClassId] = useState(params.get('class') || '');
  const activeClassId = classId || myClasses[0]?.id || '';
  const activeClass = myClasses.find((c) => c.id === activeClassId);

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
            { id: nextId(), kind: 'title', text: l.t },
            { id: nextId(), kind: 'text', text: 'محتوى الدرس التوضيحي…' },
          ],
          whatTaught: '',
          notes: '',
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

  useEffect(() => {
    if (params.get('class')) setClassId(params.get('class'));
  }, [params]);

  useEffect(() => {
    setSelectedId(null);
    setDraft(null);
    setLocalLessons([]);
    setMessage('');
  }, [activeClassId]);

  useEffect(() => {
    if (!draft && lessons.length) {
      const first = lessons[0];
      setSelectedId(first.id);
      setDraft({ ...first, blocks: first.blocks || [] });
    }
  }, [lessons, draft]);

  const selectLesson = (lesson) => {
    setSelectedId(lesson.id);
    setDraft({
      ...lesson,
      blocks: Array.isArray(lesson.blocks) ? lesson.blocks.map((b) => ({ ...b, id: b.id || nextId() })) : [],
      whatTaught: lesson.whatTaught || '',
      notes: lesson.notes || '',
      scheduledFor: lesson.scheduledFor || '',
      isHomework: !!lesson.isHomework,
      dueDate: lesson.dueDate || '',
    });
    setMessage('');
  };

  const startNew = () => {
    const lesson = emptyLesson(lessons.length);
    setSelectedId(null);
    setDraft(lesson);
    setMessage('');
  };

  const updateBlock = (id, patch) => {
    setDraft((d) => ({ ...d, blocks: d.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
  };

  const addBlock = (paletteLabel) => {
    const def = BLOCK_DEFAULTS[paletteLabel] || { kind: 'text', text: '' };
    setDraft((d) => ({ ...d, blocks: [...(d?.blocks || []), { id: nextId(), ...def }] }));
  };

  const removeBlock = (id) => setDraft((d) => ({ ...d, blocks: d.blocks.filter((b) => b.id !== id) }));

  const persist = async (statusOverride) => {
    if (!draft || !activeClass) return;
    const status = statusOverride || draft.status || 'قيد التحرير';
    const patch = {
      title: draft.title || 'درس بدون عنوان',
      chapterTitle: draft.chapterTitle || 'وحدة عامة',
      order: typeof draft.order === 'number' ? draft.order : lessons.length,
      status,
      scheduledFor: draft.scheduledFor || null,
      blocks: draft.blocks || [],
      whatTaught: draft.whatTaught || '',
      notes: draft.notes || '',
      isHomework: !!draft.isHomework,
      dueDate: draft.isHomework ? (draft.dueDate || null) : null,
      authorId: profile?.id || null,
      authorName: profile?.name || '',
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
        setDraft(saved);
        setMessage(status === 'منشور' ? 'نُشر الدرس (عرض توضيحي).' : 'حُفظ الدرس (عرض توضيحي).');
      } else {
        const id = await saveLesson(activeClassId, draft.id || null, patch);
        setSelectedId(id);
        setDraft((d) => ({ ...d, ...patch, id }));
        setMessage(status === 'منشور' ? 'نُشر الدرس وحُفظ في المساق.' : 'حُفظ الدرس.');
      }
    } catch {
      setMessage('تعذّر حفظ الدرس.');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!draft?.id || !activeClassId) return;
    if (!window.confirm('حذف هذا الدرس؟')) return;
    try {
      if (demo) {
        setLocalLessons((list) => (list.length ? list : liveLessons).filter((l) => l.id !== draft.id));
        setDraft(null);
        setSelectedId(null);
      } else {
        await deleteLesson(activeClassId, draft.id);
        setDraft(null);
        setSelectedId(null);
      }
      setMessage('حُذف الدرس.');
    } catch {
      setMessage('تعذّر الحذف.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ErrorBanner>{error && 'تعذّر تحميل صفوفك.'}</ErrorBanner>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <Field label="المساق / الصف">
          <select className="input" style={{ minWidth: 260 }} value={activeClassId} onChange={(e) => setClassId(e.target.value)}>
            {myClasses.map((c) => <option key={c.id} value={c.id}>{c.title} — {c.subject} ({c.grade})</option>)}
          </select>
        </Field>
        <span style={{ marginInlineStart: 'auto' }} />
        <button type="button" className="btn btn-primary" style={{ fontSize: 13 }} onClick={startNew}>
          <Icon name="add" size={14} /> درس يومي جديد
        </button>
      </div>
      {message && <div style={{ fontSize: 13, color: 'var(--color-accent-700)' }}>{message}</div>}

      {!activeClass ? (
        <div className="card">لا توجد مساقات مسندة إليك.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 220px', gap: 16, alignItems: 'start' }} className="ah-2col">
          <div className="card">
            <div className="card-kicker">دروس المساق</div>
            <div className="card-title" style={{ fontSize: 15, marginBottom: 8 }}>{activeClass.title}</div>
            {lessons.length === 0 && <div style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>لا دروس بعد — أنشئ درساً يومياً.</div>}
            {lessons.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => selectLesson(l)}
                style={{
                  display: 'block', width: '100%', textAlign: 'right', padding: '8px 10px', marginBottom: 6,
                  border: `1px solid ${selectedId === l.id ? 'var(--gold)' : 'var(--line)'}`,
                  borderRadius: 'var(--radius-sm)', background: 'transparent', cursor: 'pointer', fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 600 }}>{l.title}</div>
                <div style={{ fontSize: 11, color: 'var(--color-neutral-500)', display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  <span>{l.chapterTitle}</span>
                  <span className={`tag tag-${STATUS_TONE[l.status] || 'neutral'}`} style={{ fontSize: 9 }}>{l.status}</span>
                  {l.isHomework && <span className="tag tag-accent" style={{ fontSize: 9 }}>واجب</span>}
                </div>
              </button>
            ))}
          </div>

          <div className="card">
            {!draft ? (
              <div style={{ color: 'var(--color-neutral-500)', fontSize: 13 }}>اختر درساً أو أنشئ درساً جديداً.</div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  <input className="input" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} style={{ flex: 1, minWidth: 180, fontFamily: 'var(--font-heading)', fontSize: 18 }} />
                  <span className={`tag tag-${STATUS_TONE[draft.status] || 'outline'}`}>{draft.status}</span>
                  <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} disabled={saving} onClick={() => persist()}>حفظ</button>
                  <button type="button" className="btn btn-primary" style={{ fontSize: 12 }} disabled={saving} onClick={() => persist('منشور')}>نشر</button>
                  {draft.id && <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={onDelete}>حذف</button>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <Field label="الوحدة / الفصل">
                    <input className="input" value={draft.chapterTitle || ''} onChange={(e) => setDraft((d) => ({ ...d, chapterTitle: e.target.value }))} />
                  </Field>
                  <Field label="تاريخ الدرس">
                    <input className="input" type="date" value={draft.scheduledFor || ''} onChange={(e) => setDraft((d) => ({ ...d, scheduledFor: e.target.value }))} dir="ltr" style={{ textAlign: 'right' }} />
                  </Field>
                  <Field label="الترتيب">
                    <input className="input" type="number" value={draft.order ?? 0} onChange={(e) => setDraft((d) => ({ ...d, order: Number(e.target.value) }))} dir="ltr" style={{ textAlign: 'right' }} />
                  </Field>
                </div>
                <Field label="ماذا أُعطي اليوم؟ (ملخّص للمعلّم)">
                  <textarea className="input" rows={2} value={draft.whatTaught || ''} onChange={(e) => setDraft((d) => ({ ...d, whatTaught: e.target.value }))} placeholder="مثال: شرح مدّ الواو + تمارين قراءة جهرية" />
                </Field>
                <Field label="ملاحظات الدرس">
                  <textarea className="input" rows={2} value={draft.notes || ''} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="ملاحظات خاصة بالصف أو الواجب…" />
                </Field>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', margin: '10px 0 4px' }}>
                  <label className="radio">
                    <input
                      type="checkbox"
                      checked={!!draft.isHomework}
                      onChange={(e) => setDraft((d) => ({ ...d, isHomework: e.target.checked }))}
                    />
                    <span className="dot" /> يظهر كواجب في بوابة الطالب
                  </label>
                  {draft.isHomework && (
                    <Field label="تاريخ التسليم">
                      <input
                        className="input"
                        type="date"
                        value={draft.dueDate || ''}
                        onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))}
                        dir="ltr"
                        style={{ textAlign: 'right', minWidth: 160 }}
                      />
                    </Field>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: 10, border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', margin: '12px 0' }}>
                  <span style={{ fontSize: 11, color: 'var(--color-neutral-500)', alignSelf: 'center' }}>إضافة كتلة:</span>
                  {blockPalette.map((b) => (
                    <button key={b.label} type="button" className="btn btn-secondary" style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => addBlock(b.label)}>
                      <Icon name={b.icon} size={13} /> {b.label}
                    </button>
                  ))}
                </div>

                <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(draft.blocks || []).map((blk) => (
                    <div key={blk.id} style={{ position: 'relative', paddingInlineEnd: 28 }}>
                      <button type="button" onClick={() => removeBlock(blk.id)} style={{ position: 'absolute', top: 0, insetInlineStart: 0, background: 'none', border: 0, cursor: 'pointer', color: 'var(--color-neutral-400)' }}>
                        <Icon name="close" size={14} />
                      </button>
                      {blk.kind === 'title' && (
                        <input className="input" value={blk.text || ''} onChange={(e) => updateBlock(blk.id, { text: e.target.value })} style={{ fontFamily: 'var(--font-heading)', fontSize: 18 }} />
                      )}
                      {blk.kind === 'text' && (
                        <textarea className="input" rows={3} value={blk.text || ''} onChange={(e) => updateBlock(blk.id, { text: e.target.value })} />
                      )}
                      {blk.kind === 'list' && (
                        <textarea
                          className="input"
                          rows={3}
                          value={(blk.items || []).join('\n')}
                          onChange={(e) => updateBlock(blk.id, { items: e.target.value.split('\n') })}
                          placeholder="بند في كل سطر"
                        />
                      )}
                      {['image', 'table', 'file', 'embed', 'slide'].includes(blk.kind) && (
                        <div className="ah-cover" style={{ height: 70 }}>
                          {{ image: 'صورة', table: 'جدول', file: 'مرفق', embed: 'تضمين', slide: 'شريحة' }[blk.kind]}
                          <input className="input" style={{ marginTop: 6, fontSize: 12 }} placeholder="رابط أو وصف (اختياري)" value={blk.text || ''} onChange={(e) => updateBlock(blk.id, { text: e.target.value })} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="card">
            <div className="card-kicker">طلاب المساق</div>
            <div className="card-title" style={{ fontSize: 14, marginBottom: 8 }}>{enrolled.length} طالباً</div>
            {enrolled.length === 0 && <div style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>لا طلاب مسجّلين</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 420, overflow: 'auto' }}>
              {enrolled.map((s) => (
                <div key={s.studentId || s.id} style={{ fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ fontWeight: 600 }}>{s.studentName || s.name}</div>
                  <div className="ah-tabnum" style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>{s.displayId}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
