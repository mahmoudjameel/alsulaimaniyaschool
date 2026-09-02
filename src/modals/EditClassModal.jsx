import { useEffect, useMemo, useState } from 'react';
import Modal from '../components/Modal';
import ChipToggle from '../components/ChipToggle';
import { Field } from '../components/ui';
import { updateClass, syncClassStudentsCount, enrollMatchingStudentsIntoClass } from '../services/academics';
import { logActivity } from '../services/activity';
import { useAuth } from '../context/AuthContext';
import { useAssignableTeachers } from '../hooks/useAssignableTeachers';
import { useAcademicStages } from '../hooks/useAcademicStages';
import { useTeachingSubjects } from '../hooks/useTeachingSubjects';
import { teachersForSubjectLabel } from '../services/teachingSubjects';
import {
  CLASS_DAYS, CLASS_SUBJECTS, deriveClassMetaFromSchedule,
  emptyScheduleRow, expandScheduleSlots, groupScheduleSlots, subjectsLabel, toggleInList,
} from '../lib/classForm';
import { SECTION_OPTIONS } from '../lib/constants';
import { resolveClassSection } from '../lib/classPlacement';

const VISIBILITIES = ['المدرسة', 'عام', 'دعوة فقط'];
const SHIFTS = ['صباحي', 'مسائي'];

export default function EditClassModal({ cls, onClose, demo }) {
  const { profile } = useAuth();
  const { teachers } = useAssignableTeachers();
  const { stages, labels } = useAcademicStages();
  const { subjects, labels: subjectLabels } = useTeachingSubjects();
  const scheduleSubjects = subjectLabels.length ? subjectLabels : CLASS_SUBJECTS;
  const [title, setTitle] = useState(cls?.title || '');
  const [grade, setGrade] = useState(cls?.grade || '');
  const [classSection, setClassSection] = useState(() => resolveClassSection(cls) || SECTION_OPTIONS[0]);
  const [shift, setShift] = useState(cls?.shift || SHIFTS[0]);
  const [visibility, setVisibility] = useState(cls?.visibility || VISIBILITIES[0]);
  const [schedule, setSchedule] = useState(() => groupScheduleSlots(cls?.schedule, cls));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const teachersById = useMemo(
    () => Object.fromEntries(teachers.map((t) => [t.id, t])),
    [teachers],
  );

  useEffect(() => {
    if (!grade && labels[0]) setGrade(labels[0]);
  }, [labels, grade]);

  const updateSlot = (i, patch) => setSchedule((s) => s.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const toggleDay = (i, day) => {
    setSchedule((s) => s.map((row, j) => {
      if (j !== i) return row;
      const days = toggleInList(row.days, day);
      return { ...row, days: days.length ? days : [day] };
    }));
  };
  const addSlot = () => {
    const last = schedule[schedule.length - 1];
    setSchedule((s) => [...s, emptyScheduleRow({
      subject: last?.subject || scheduleSubjects[0],
      teacherId: last?.teacherId || cls?.teacherId || '',
      start: last?.start || '08:00',
      end: last?.end || '08:45',
    })]);
  };
  const removeSlot = (i) => setSchedule((s) => s.filter((_, j) => j !== i));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (demo) { setError('وضع العرض: صِل Firebase لحفظ التعديل.'); return; }
    if (!cls?.id) return;

    for (let i = 0; i < schedule.length; i += 1) {
      const row = schedule[i];
      if (!row.subject) { setError(`الحصة ${i + 1}: اختر المادة.`); return; }
      if (!row.teacherId) { setError(`الحصة ${i + 1}: اختر المعلّم.`); return; }
      const teacher = teachersById[row.teacherId];
      if (!teacher?.login) {
        setError(`الحصة ${i + 1}: اختر معلّماً لديه حساب دخول.`);
        return;
      }
      if (!row.days?.length) { setError(`الحصة ${i + 1}: اختر يوماً واحداً على الأقل.`); return; }
    }

    const flatSchedule = expandScheduleSlots(schedule, teachersById);
    if (!flatSchedule.length) { setError('أضف حصة واحدة على الأقل.'); return; }

    const meta = deriveClassMetaFromSchedule(flatSchedule, teachers);
    setSubmitting(true);
    setError('');
    try {
      await updateClass(cls.id, {
        title,
        ...meta,
        grade,
        classSection: classSection || null,
        shift,
        visibility,
        schedule: flatSchedule,
      });
      await enrollMatchingStudentsIntoClass(cls.id, {
        ...cls,
        title,
        ...meta,
        grade,
        classSection: classSection || null,
        shift,
        schedule: flatSchedule,
      });
      await syncClassStudentsCount(cls.id);
      await logActivity({
        type: 'class_updated',
        actorUid: profile?.id,
        actorName: profile?.name,
        actorRole: profile?.role,
        summary: `تعديل صفّ: ${title} (${subjectsLabel(meta.subjects)}) — ${grade}${classSection ? ` / ${classSection}` : ''} · ${meta.teacher}`,
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
    <Modal title="تعديل الصف والجدول" onClose={onClose} onSubmit={onSubmit} submitLabel="حفظ التعديلات" submitting={submitting} error={error} width={620}>
      <div className="dialog-body">
        لكل حصة مادتها ومعلّمها. يظهر الصف في بوابة كل معلّم معيّن على حصة واحدة على الأقل.
      </div>

      <Field label="عنوان الصف">
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Field label="الصف الدراسي">
          <select className="input" value={grade} onChange={(e) => setGrade(e.target.value)}>
            {stages.map((s) => <option key={s.id} value={s.labelAr}>{s.labelAr}</option>)}
            {grade && !stages.some((s) => s.labelAr === grade) && <option value={grade}>{grade}</option>}
          </select>
        </Field>
        <Field label="الشعبة">
          <select className="input" value={classSection} onChange={(e) => setClassSection(e.target.value)}>
            {SECTION_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
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
        <label>جدول الحصص</label>
        <div style={{ fontSize: 12, color: 'var(--color-neutral-500)', marginBottom: 10, lineHeight: 1.6 }}>
          كل بطاقة = حصة (مادة + معلّم + وقت + أيام).
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {schedule.map((row, i) => (
            <div
              key={i}
              style={{
                border: '1px solid var(--line)',
                borderRadius: 12,
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                background: 'var(--color-neutral-50, #fafafa)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>حصة {i + 1}</span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}
                  onClick={() => removeSlot(i)}
                  disabled={schedule.length === 1}
                >
                  حذف
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="المادة">
                  <select className="input" value={row.subject} onChange={(e) => updateSlot(i, { subject: e.target.value, teacherId: '' })}>
                    {scheduleSubjects.map((s) => <option key={s} value={s}>{s}</option>)}
                    {row.subject && !scheduleSubjects.includes(row.subject) && (
                      <option value={row.subject}>{row.subject}</option>
                    )}
                  </select>
                </Field>
                <Field label="المعلّم">
                  <select
                    className="input"
                    value={row.teacherId}
                    onChange={(e) => updateSlot(i, { teacherId: e.target.value })}
                    required
                  >
                    <option value="" disabled>اختر معلّماً…</option>
                    {teachersForSubjectLabel(teachers, subjects, row.subject).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}{t.subject ? ` — ${t.subject}` : ''}{t.login ? '' : ' (دليل فقط)'}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div>
                <div style={{ fontSize: 12, color: 'var(--color-neutral-600)', marginBottom: 6 }}>الأيام</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {CLASS_DAYS.map((d) => (
                    <ChipToggle key={d} selected={(row.days || []).includes(d)} onClick={() => toggleDay(i, d)}>
                      {d}
                    </ChipToggle>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="من">
                  <input className="input" type="time" dir="ltr" value={row.start} onChange={(e) => updateSlot(i, { start: e.target.value })} />
                </Field>
                <Field label="إلى">
                  <input className="input" type="time" dir="ltr" value={row.end} onChange={(e) => updateSlot(i, { end: e.target.value })} />
                </Field>
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-secondary" style={{ fontSize: 13, marginTop: 12 }} onClick={addSlot}>
          + إضافة حصة (مادة / معلّم)
        </button>
      </div>
    </Modal>
  );
}
