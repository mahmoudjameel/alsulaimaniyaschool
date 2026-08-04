import { useEffect, useState } from 'react';
import Modal from '../components/Modal';
import { Field } from '../components/ui';
import { updateClass, syncClassStudentsCount } from '../services/academics';
import { logActivity } from '../services/activity';
import { useAuth } from '../context/AuthContext';
import { useAssignableTeachers } from '../hooks/useAssignableTeachers';
import { useAcademicStages } from '../hooks/useAcademicStages';

const SUBJECTS = ['لغة عربية', 'رياضيات', 'علوم', 'إنجليزي', 'تربية إسلامية', 'فنون', 'الحاسوب والتقنية', 'التربية الرياضية'];
const VISIBILITIES = ['المدرسة', 'عام', 'دعوة فقط'];
const SHIFTS = ['صباحي', 'مسائي'];
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];

export default function EditClassModal({ cls, onClose, demo }) {
  const { profile } = useAuth();
  const { teachers } = useAssignableTeachers();
  const { stages, labels } = useAcademicStages();
  const [title, setTitle] = useState(cls?.title || '');
  const [subject, setSubject] = useState(cls?.subject || SUBJECTS[0]);
  const [teacherId, setTeacherId] = useState(cls?.teacherId || '');
  const [grade, setGrade] = useState(cls?.grade || '');
  const [shift, setShift] = useState(cls?.shift || SHIFTS[0]);
  const [visibility, setVisibility] = useState(cls?.visibility || VISIBILITIES[0]);
  const [schedule, setSchedule] = useState(
    Array.isArray(cls?.schedule) && cls.schedule.length
      ? cls.schedule.map((s) => ({ day: s.day || DAYS[0], start: s.start || '08:00', end: s.end || '08:45' }))
      : [{ day: DAYS[0], start: '08:00', end: '08:45' }],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!grade && labels[0]) setGrade(labels[0]);
  }, [labels, grade]);

  const updateSlot = (i, patch) => setSchedule((s) => s.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const addSlot = () => setSchedule((s) => [...s, { day: DAYS[0], start: '08:00', end: '08:45' }]);
  const removeSlot = (i) => setSchedule((s) => s.filter((_, j) => j !== i));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (demo) { setError('وضع العرض: صِل Firebase لحفظ التعديل.'); return; }
    if (!cls?.id) return;
    const teacher = teachers.find((t) => t.id === teacherId);
    if (!teacher) { setError('اختر معلّماً لديه حساب دخول إن أمكن.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await updateClass(cls.id, {
        title, subject, grade, shift, visibility, schedule,
        teacherId: teacher.id,
        teacherName: teacher.name,
      });
      await syncClassStudentsCount(cls.id);
      await logActivity({
        type: 'class_updated',
        actorUid: profile?.id,
        actorName: profile?.name,
        actorRole: profile?.role,
        summary: `تعديل صفّ: ${title} — معلّم ${teacher.name}`,
        targetType: 'class',
        targetId: cls.id,
      });
      onClose();
    } catch {
      setError('تعذّر حفظ التعديل.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="تعديل الصف والجدول" onClose={onClose} onSubmit={onSubmit} submitLabel="حفظ التعديلات" submitting={submitting} error={error} width={560}>
      <div className="dialog-body">
        عيّن معلّماً بحساب دخول حتى يظهر الصف في بوابة المعلّم. الجدول يغذي «جدول الحصص» عند المعلّم.
      </div>
      <Field label="عنوان الصف">
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="المادة">
          <select className="input" value={subject} onChange={(e) => setSubject(e.target.value)}>
            {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="المعلّم">
          <select className="input" value={teacherId} onChange={(e) => setTeacherId(e.target.value)} required>
            <option value="" disabled>اختر معلّماً…</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} — {t.subject}{t.login ? '' : ' (دليل فقط)'}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {teacherId && teachers.find((t) => t.id === teacherId && !t.login) && (
        <div style={{ fontSize: 12, color: 'var(--color-accent-2-700)', lineHeight: 1.6 }}>
          هذا الملف من الدليل فقط وليس حساب دخول — الصف لن يظهر في بوابة المعلّم. أنشئ حساب معلّم من «المستخدمون» ثم عيّنه هنا.
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="الصف الدراسي">
          <select className="input" value={grade} onChange={(e) => setGrade(e.target.value)}>
            {stages.map((s) => <option key={s.id} value={s.labelAr}>{s.labelAr}</option>)}
            {grade && !stages.some((s) => s.labelAr === grade) && <option value={grade}>{grade}</option>}
          </select>
        </Field>
        <Field label="الدوام">
          <div className="seg" style={{ marginTop: 2 }}>
            {SHIFTS.map((s) => (
              <label key={s} className="seg-opt">
                <input type="radio" name="edit-shift" checked={shift === s} onChange={() => setShift(s)} />
                <span>{s}</span>
              </label>
            ))}
          </div>
        </Field>
      </div>
      <Field label="الظهور">
        <div className="seg" style={{ marginTop: 2 }}>
          {VISIBILITIES.map((v) => (
            <label key={v} className="seg-opt">
              <input type="radio" name="edit-vis" checked={visibility === v} onChange={() => setVisibility(v)} />
              <span>{v}</span>
            </label>
          ))}
        </div>
      </Field>
      <div className="field">
        <label>جدول الحصص الأسبوعي</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          {schedule.map((row, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr auto', gap: 8, alignItems: 'center' }}>
              <select className="input" value={row.day} onChange={(e) => updateSlot(i, { day: e.target.value })}>
                {DAYS.map((d) => <option key={d}>{d}</option>)}
              </select>
              <input className="input" type="time" dir="ltr" value={row.start} onChange={(e) => updateSlot(i, { start: e.target.value })} />
              <input className="input" type="time" dir="ltr" value={row.end} onChange={(e) => updateSlot(i, { end: e.target.value })} />
              <button type="button" className="btn btn-icon btn-ghost" onClick={() => removeSlot(i)} disabled={schedule.length === 1}>×</button>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-ghost" style={{ fontSize: 12, marginTop: 8 }} onClick={addSlot}>+ إضافة حصّة</button>
      </div>
    </Modal>
  );
}
