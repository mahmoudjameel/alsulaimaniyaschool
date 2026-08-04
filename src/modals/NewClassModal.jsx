import { useEffect, useState } from 'react';
import { orderBy } from 'firebase/firestore';
import Modal from '../components/Modal';
import { Field } from '../components/ui';
import { createClass } from '../services/academics';
import { logActivity } from '../services/activity';
import { useAuth } from '../context/AuthContext';
import { useLiveOrDemo } from '../hooks/useFirestore';
import { useAcademicStages } from '../hooks/useAcademicStages';
import { demoTeacherProfiles } from '../data/demo';

const SUBJECTS = ['لغة عربية', 'رياضيات', 'علوم', 'إنجليزي', 'تربية إسلامية', 'فنون', 'الحاسوب والتقنية', 'التربية الرياضية'];
const VISIBILITIES = ['المدرسة', 'عام', 'دعوة فقط'];
const SHIFTS = ['صباحي', 'مسائي'];
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];

export default function NewClassModal({ onClose, demo }) {
  const { profile } = useAuth();
  const { data: teachers } = useLiveOrDemo('teacherProfiles', [orderBy('name', 'asc')], demoTeacherProfiles);
  const { stages, labels } = useAcademicStages();
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [teacherId, setTeacherId] = useState('');
  const [grade, setGrade] = useState('');
  const [shift, setShift] = useState(SHIFTS[0]);
  const [visibility, setVisibility] = useState(VISIBILITIES[0]);
  const [schedule, setSchedule] = useState([{ day: DAYS[0], start: '08:00', end: '08:45' }]);
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
    if (demo) { setError('وضع العرض التوضيحي: صِل مشروع Firebase لإنشاء الصفوف فعلياً.'); return; }
    const teacher = teachers.find((t) => t.id === teacherId);
    if (!teacher) { setError('اختر معلّماً.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const classId = await createClass({
        title, subject, teacherId: teacher.id, teacherName: teacher.name, grade, shift, visibility, schedule,
      });
      await logActivity({
        type: 'class_created', actorUid: profile?.id, actorName: profile?.name, actorRole: profile?.role,
        summary: `إنشاء صفّ جديد: ${title} (${subject}) — ${teacher.name}`, targetType: 'class', targetId: classId,
      });
      onClose();
    } catch {
      setError('تعذّر إنشاء الصف. حاول مجدداً.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="إنشاء صفّ جديد" onClose={onClose} onSubmit={onSubmit} submitLabel="إنشاء الصف" submitting={submitting} error={error} width={560}>
      <div className="dialog-body">يُنشأ الصفّ فارغاً ويمكن للمعلّم إضافة الدروس لاحقاً من بوابته.</div>
      <Field label="عنوان الصف"><input className="input" placeholder="مثال: القراءة التفاعلية" value={title} onChange={(e) => setTitle(e.target.value)} required /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="المادة">
          <select className="input" value={subject} onChange={(e) => setSubject(e.target.value)}>
            {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="المعلّم">
          <select className="input" value={teacherId} onChange={(e) => setTeacherId(e.target.value)} required>
            <option value="" disabled>اختر معلّماً…</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.subject}</option>)}
          </select>
        </Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="الصف الدراسي">
          <select className="input" value={grade} onChange={(e) => setGrade(e.target.value)}>
            {stages.map((s) => <option key={s.id} value={s.labelAr}>{s.labelAr}</option>)}
          </select>
        </Field>
        <Field label="الدوام">
          <div className="seg" style={{ marginTop: 2 }}>
            {SHIFTS.map((s) => (
              <label key={s} className="seg-opt"><input type="radio" name="shift" checked={shift === s} onChange={() => setShift(s)} /><span>{s}</span></label>
            ))}
          </div>
        </Field>
      </div>
      <Field label="الظهور">
        <div className="seg" style={{ marginTop: 2 }}>
          {VISIBILITIES.map((v) => (
            <label key={v} className="seg-opt"><input type="radio" name="vis" checked={visibility === v} onChange={() => setVisibility(v)} /><span>{v}</span></label>
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
