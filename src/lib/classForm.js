/** Shared helpers for multi-subject / multi-teacher / multi-day class forms. */

export const CLASS_SUBJECTS = [
  'لغة عربية', 'رياضيات', 'علوم', 'إنجليزي', 'تربية إسلامية',
  'فنون', 'الحاسوب والتقنية', 'التربية الرياضية',
];

export const CLASS_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];

export function emptyScheduleRow({
  days = [CLASS_DAYS[0]],
  start = '08:00',
  end = '08:45',
  subject = CLASS_SUBJECTS[0],
  teacherId = '',
} = {}) {
  return { days: [...days], start, end, subject, teacherId };
}

/** Normalize class subjects from legacy `subject` string or `subjects` array. */
export function normalizeSubjects(clsOrSubjects, fallback = CLASS_SUBJECTS[0]) {
  if (Array.isArray(clsOrSubjects)) {
    const list = clsOrSubjects.map((s) => String(s || '').trim()).filter(Boolean);
    return list.length ? list : [fallback];
  }
  if (clsOrSubjects && typeof clsOrSubjects === 'object') {
    if (Array.isArray(clsOrSubjects.subjects) && clsOrSubjects.subjects.length) {
      return clsOrSubjects.subjects.map((s) => String(s || '').trim()).filter(Boolean);
    }
    const fromSchedule = [...new Set(
      (clsOrSubjects.schedule || []).map((s) => String(s.subject || '').trim()).filter(Boolean),
    )];
    if (fromSchedule.length) return fromSchedule;
    const raw = String(clsOrSubjects.subject || '').trim();
    if (!raw) return [fallback];
    return raw.split(/\s*[·,،|/]\s*/).map((s) => s.trim()).filter(Boolean);
  }
  const raw = String(clsOrSubjects || '').trim();
  if (!raw) return [fallback];
  return raw.split(/\s*[·,،|/]\s*/).map((s) => s.trim()).filter(Boolean);
}

export function subjectsLabel(subjects) {
  return (subjects || []).filter(Boolean).join(' · ') || CLASS_SUBJECTS[0];
}

/** True if this teacher is assigned at class level or on any schedule slot. */
export function classHasTeacher(cls, teacherId) {
  if (!cls || !teacherId) return false;
  if (cls.teacherId === teacherId) return true;
  if (Array.isArray(cls.teacherIds) && cls.teacherIds.includes(teacherId)) return true;
  return (cls.schedule || []).some((s) => s.teacherId === teacherId);
}

/** Slots belonging to a teacher (legacy: all slots if only class-level teacher). */
export function scheduleForTeacher(cls, teacherId) {
  const slots = cls?.schedule || [];
  if (!teacherId) return slots;
  const onClass = cls.teacherId === teacherId || (cls.teacherIds || []).includes(teacherId);
  return slots.filter((s) => {
    if (s.teacherId) return s.teacherId === teacherId;
    // Slot without teacherId (legacy) → show if teacher owns the class
    return onClass;
  });
}

/**
 * Group flat schedule into form rows.
 * Same time + subject + teacher → multi-day chips.
 */
export function groupScheduleSlots(flat, cls = null, fallbackDay = CLASS_DAYS[0]) {
  if (!Array.isArray(flat) || !flat.length) {
    return [emptyScheduleRow({
      subject: normalizeSubjects(cls)[0],
      teacherId: cls?.teacherId || '',
    })];
  }
  const map = new Map();
  for (const s of flat) {
    const start = s.start || '08:00';
    const end = s.end || '08:45';
    const subject = s.subject || (cls && normalizeSubjects(cls)[0]) || CLASS_SUBJECTS[0];
    const teacherId = s.teacherId || cls?.teacherId || '';
    const key = `${start}|${end}|${subject}|${teacherId}`;
    if (!map.has(key)) map.set(key, { days: [], start, end, subject, teacherId });
    const day = s.day || fallbackDay;
    const row = map.get(key);
    if (!row.days.includes(day)) row.days.push(day);
  }
  return [...map.values()].map((r) => ({
    ...r,
    days: r.days.length ? r.days : [fallbackDay],
  }));
}

/** Expand multi-day form rows into flat schedule entries (with subject + teacher). */
export function expandScheduleSlots(rows, teachersById = {}) {
  const out = [];
  for (const row of rows || []) {
    const days = Array.isArray(row.days) && row.days.length
      ? row.days
      : (row.day ? [row.day] : []);
    const teacher = teachersById[row.teacherId];
    const teacherName = teacher?.name || row.teacherName || '';
    for (const day of days) {
      out.push({
        day,
        start: row.start || '08:00',
        end: row.end || '08:45',
        subject: row.subject || CLASS_SUBJECTS[0],
        teacherId: row.teacherId || null,
        teacherName: teacherName || null,
      });
    }
  }
  return out;
}

/** Derive denormalized class fields from flat schedule + teacher list. */
export function deriveClassMetaFromSchedule(flatSchedule, teachers = []) {
  const byId = Object.fromEntries((teachers || []).map((t) => [t.id, t]));
  const subjects = [...new Set(
    (flatSchedule || []).map((s) => String(s.subject || '').trim()).filter(Boolean),
  )];
  const teacherIds = [...new Set(
    (flatSchedule || []).map((s) => s.teacherId).filter(Boolean),
  )];
  const teacherNames = teacherIds
    .map((id) => byId[id]?.name || flatSchedule.find((s) => s.teacherId === id)?.teacherName)
    .filter(Boolean);
  const primaryId = teacherIds.find((id) => byId[id]?.login) || teacherIds[0] || null;
  const primaryName = (primaryId && byId[primaryId]?.name)
    || teacherNames[0]
    || 'غير محدّد';

  return {
    subjects: subjects.length ? subjects : [CLASS_SUBJECTS[0]],
    subject: subjects.length ? subjects.join(' · ') : CLASS_SUBJECTS[0],
    teacherIds,
    teacherId: primaryId,
    teacher: teacherNames.length > 1 ? teacherNames.join(' · ') : primaryName,
  };
}

export function toggleInList(list, value) {
  const set = new Set(list || []);
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return [...set];
}
