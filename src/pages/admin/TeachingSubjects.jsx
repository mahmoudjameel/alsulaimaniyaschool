import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import { EmptyRow, ErrorBanner, Field } from '../../components/ui';
import SubjectTeacherPicker from '../../components/SubjectTeacherPicker';
import { useTeachingSubjects } from '../../hooks/useTeachingSubjects';
import { useAssignableTeachers } from '../../hooks/useAssignableTeachers';
import {
  createTeachingSubject,
  deleteTeachingSubject,
  seedDefaultTeachingSubjects,
  setSubjectTeachers,
  updateTeachingSubject,
} from '../../services/teachingSubjects';
import { logActivity } from '../../services/activity';
import { useAuth } from '../../context/AuthContext';

function LinkTeachersModal({ subject, teachers, demo, onClose }) {
  const { profile } = useAuth();
  const [selected, setSelected] = useState(() => [...(subject?.teacherIds || [])]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    if (demo) { setError('صِل Firebase للحفظ.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await setSubjectTeachers(subject.id, selected);
      await logActivity({
        type: 'subject_teachers_updated',
        actorUid: profile?.id,
        actorName: profile?.name,
        actorRole: profile?.role,
        summary: `ربط معلّمين بمادة: ${subject.labelAr}`,
        targetType: 'teachingSubject',
        targetId: subject.id,
      }).catch(() => {});
      onClose();
    } catch {
      setError('تعذّر حفظ الربط.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={`معلّمو مادة «${subject?.labelAr}»`}
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="حفظ الربط"
      submitting={submitting}
      error={error}
      width={480}
    >
      <div className="dialog-body">
        اضغط على اسم المعلّم لتحديده أو إلغاء تحديده. يمكن للمعلّم تدريس أكثر من مادة.
      </div>
      <SubjectTeacherPicker
        teachers={teachers}
        selectedIds={selected}
        onChange={setSelected}
      />
    </Modal>
  );
}

export default function TeachingSubjects() {
  const { allSubjects, demo, error } = useTeachingSubjects({ includeInactive: true });
  const { teachers } = useAssignableTeachers();
  const [labelAr, setLabelAr] = useState('');
  const [shortLabel, setShortLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editShort, setEditShort] = useState('');
  const [linking, setLinking] = useState(null);

  const teacherMap = useMemo(() => {
    const m = new Map();
    for (const t of teachers) m.set(t.id, t);
    return m;
  }, [teachers]);

  const onAdd = async (e) => {
    e.preventDefault();
    if (!labelAr.trim()) return;
    if (demo) { setMessage('وضع العرض: صِل Firebase لحفظ المواد.'); return; }
    setBusy(true);
    setMessage('');
    try {
      await createTeachingSubject({
        labelAr: labelAr.trim(),
        shortLabel: shortLabel.trim() || labelAr.trim(),
        order: allSubjects.length,
      });
      setLabelAr('');
      setShortLabel('');
      setMessage('أُضيفت المادة — يمكنك ربط المعلّمين الآن.');
    } catch {
      setMessage('تعذّر إضافة المادة.');
    } finally {
      setBusy(false);
    }
  };

  const onSeed = async () => {
    if (demo) { setMessage('وضع العرض: صِل Firebase للزرع.'); return; }
    setBusy(true);
    setMessage('');
    try {
      const res = await seedDefaultTeachingSubjects();
      if (res.created === 0) {
        setMessage('المواد موجودة مسبقاً.');
      } else {
        setMessage(`زُرعت ${res.created} مواد افتراضية${res.linked ? ` وربط ${res.linked} معلّم` : ''}.`);
      }
    } catch {
      setMessage('تعذّر زرع المواد.');
    } finally {
      setBusy(false);
    }
  };

  const onSaveEdit = async (s) => {
    if (demo || !editLabel.trim()) return;
    await updateTeachingSubject(s.id, {
      labelAr: editLabel.trim(),
      shortLabel: editShort.trim() || editLabel.trim(),
    });
    setEditingId(null);
  };

  const onToggle = async (s) => {
    if (demo) return;
    await updateTeachingSubject(s.id, { active: s.active === false });
  };

  const onDelete = async (s) => {
    if (demo) return;
    if (!window.confirm(`حذف مادة «${s.labelAr}»؟ لن تُحذف الصفوف المرتبطة.`)) return;
    await deleteTeachingSubject(s.id);
  };

  const onMove = async (s, dir) => {
    if (demo) return;
    const idx = allSubjects.findIndex((x) => x.id === s.id);
    const swap = allSubjects[idx + dir];
    if (!swap) return;
    await Promise.all([
      updateTeachingSubject(s.id, { order: swap.order ?? idx + dir }),
      updateTeachingSubject(swap.id, { order: s.order ?? idx }),
    ]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ErrorBanner>{error && 'تعذّر تحميل مواد التدريس.'}</ErrorBanner>

      <div className="card" style={{ borderColor: 'var(--color-accent-300)', background: 'var(--color-accent-100)', padding: '14px 16px' }}>
        <div style={{ fontSize: 13, color: 'var(--color-accent-900)', lineHeight: 1.7 }}>
          أضِف <strong>مواد التدريس</strong> واربطها بالمعلّمين. المعلّم الواحد يمكن أن يدرّس <strong>أكثر من مادة</strong>.
        </div>
      </div>

      <form className="card" onSubmit={onAdd}>
        <div className="card-title" style={{ marginBottom: 10 }}>إضافة مادة</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr auto', gap: 12, alignItems: 'end' }}>
          <Field label="اسم المادة">
            <input className="input" placeholder="مثال: اللغة العربية" value={labelAr} onChange={(e) => setLabelAr(e.target.value)} required />
          </Field>
          <Field label="اسم مختصر (في الجدول)">
            <input className="input" placeholder="مثال: لغة عربية" value={shortLabel} onChange={(e) => setShortLabel(e.target.value)} />
          </Field>
          <button type="submit" className="btn btn-primary" disabled={busy} style={{ height: 42 }}>
            <Icon name="add" size={14} /> إضافة
          </button>
        </div>
      </form>

      {message && <div style={{ fontSize: 13, color: 'var(--color-accent-700)' }}>{message}</div>}

      <div className="card ah-table-wrap" style={{ padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
          <h4 style={{ margin: 0 }}>مواد التدريس · المعلّمون</h4>
          <Link to="/admin/teachers" className="ah-tablink" style={{ fontSize: 13, color: 'var(--gold)' }}>دليل المعلّمين ←</Link>
          <span style={{ marginInlineStart: 'auto' }} />
          {allSubjects.length === 0 && (
            <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={onSeed} disabled={busy}>
              زرع المواد الافتراضية
            </button>
          )}
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>المادة</th>
              <th>مختصر</th>
              <th>المعلّمون</th>
              <th>الحالة</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {allSubjects.length === 0 && (
              <EmptyRow colSpan={6}>لا مواد بعد — أضف مادة أو ازرع الافتراضية (عربي، رياضيات، علوم…).</EmptyRow>
            )}
            {allSubjects.map((s, i) => {
              const linked = (s.teacherIds || []).map((id) => teacherMap.get(id)).filter(Boolean);
              return (
                <tr key={s.id} style={{ opacity: s.active === false ? 0.55 : 1 }}>
                  <td className="ah-tabnum">{(s.order ?? i) + 1}</td>
                  <td>
                    {editingId === s.id ? (
                      <input className="input" style={{ fontSize: 13, padding: '4px 8px' }} value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
                    ) : s.labelAr}
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--color-neutral-600)' }}>
                    {editingId === s.id ? (
                      <input className="input" style={{ fontSize: 13, padding: '4px 8px' }} value={editShort} onChange={(e) => setEditShort(e.target.value)} />
                    ) : (s.shortLabel || '—')}
                  </td>
                  <td>
                    {linked.length === 0 ? (
                      <span className="tag tag-outline" style={{ fontSize: 11 }}>لا معلّم</span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {linked.map((t) => (
                          <span key={t.id} className="tag tag-neutral" style={{ fontSize: 11 }}>{t.name}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`tag tag-${s.active === false ? 'neutral' : 'accent'}`}>
                      {s.active === false ? 'موقوفة' : 'نشطة'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>
                    {editingId === s.id ? (
                      <>
                        <button type="button" className="btn btn-primary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => onSaveEdit(s)}>حفظ</button>{' '}
                        <button type="button" className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => setEditingId(null)}>إلغاء</button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="btn btn-ghost" style={{ fontSize: 11 }} disabled={i === 0} onClick={() => onMove(s, -1)}>↑</button>
                        <button type="button" className="btn btn-ghost" style={{ fontSize: 11 }} disabled={i === allSubjects.length - 1} onClick={() => onMove(s, 1)}>↓</button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ fontSize: 11 }}
                          onClick={() => setLinking(s)}
                        >
                          ربط معلّمين
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ fontSize: 11 }}
                          onClick={() => {
                            setEditingId(s.id);
                            setEditLabel(s.labelAr);
                            setEditShort(s.shortLabel || '');
                          }}
                        >
                          تعديل
                        </button>
                        <button type="button" className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => onToggle(s)}>
                          {s.active === false ? 'تفعيل' : 'إيقاف'}
                        </button>
                        <button type="button" className="btn btn-ghost" style={{ fontSize: 11, color: 'var(--color-accent-2-700)' }} onClick={() => onDelete(s)}>حذف</button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {linking && (
        <LinkTeachersModal
          subject={linking}
          teachers={teachers}
          demo={demo}
          onClose={() => setLinking(null)}
        />
      )}
    </div>
  );
}
