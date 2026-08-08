import { scheduleForTeacher } from '../lib/classForm';

/** Compact list of weekly slots — optionally only this teacher's periods. */
export default function ClassScheduleLines({
  cls,
  teacherId = null,
  empty = 'لا مواعيد حصص بعد',
  style,
}) {
  const slots = teacherId
    ? scheduleForTeacher(cls, teacherId)
    : (cls?.schedule || []);

  if (!slots.length) {
    return (
      <div style={{ fontSize: 12, color: 'var(--color-neutral-500)', ...(style || {}) }}>
        {empty}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, ...(style || {}) }}>
      {slots.map((s, i) => (
        <div
          key={`${s.day}-${s.start}-${s.subject}-${s.teacherId || ''}-${i}`}
          style={{ fontSize: 12, color: 'var(--color-neutral-600)', lineHeight: 1.45 }}
        >
          <span style={{ fontWeight: 600 }}>{s.day}</span>
          {' · '}
          <span className="ah-tabnum" dir="ltr">{s.start}{s.end ? `–${s.end}` : ''}</span>
          {s.subject ? ` · ${s.subject}` : ''}
          {!teacherId && s.teacherName ? ` · ${s.teacherName}` : ''}
        </div>
      ))}
    </div>
  );
}
