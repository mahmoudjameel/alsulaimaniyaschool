/** School-week schedule helpers (Arabic day names, including spelling variants). */

export const SCHOOL_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];

const DAY_ALIASES = {
  الأحد: 'الأحد',
  الاحد: 'الأحد',
  الاثنين: 'الاثنين',
  الإثنين: 'الاثنين',
  الثلاثاء: 'الثلاثاء',
  الأربعاء: 'الأربعاء',
  الاربعاء: 'الأربعاء',
  الخميس: 'الخميس',
  الجمعة: 'الجمعة',
  السبت: 'السبت',
};

const WEEKDAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export function normalizeDay(day) {
  return DAY_ALIASES[String(day || '').trim()] || String(day || '').trim();
}

export function todaySchoolDay(date = new Date()) {
  return WEEKDAY_NAMES[date.getDay()];
}

/**
 * Flatten class.schedule slots for one weekday; sorted by start time.
 * @param {object} [opts]
 * @param {string} [opts.teacherId] — only slots for this teacher (legacy classes without slot teachers still match class-level)
 */
export function slotsForDay(classes, dayName, opts = {}) {
  const day = normalizeDay(dayName);
  const { teacherId } = opts;
  const rows = [];
  for (const c of classes || []) {
    const slots = c.schedule || [];
    const onClass = !teacherId
      || c.teacherId === teacherId
      || (c.teacherIds || []).includes(teacherId);
    for (const slot of slots) {
      if (normalizeDay(slot.day) !== day) continue;
      if (teacherId) {
        if (slot.teacherId) {
          if (slot.teacherId !== teacherId) continue;
        } else if (!onClass) {
          continue;
        }
      }
      rows.push({
        classId: c.id,
        title: c.title,
        subject: slot.subject || c.subject,
        teacherId: slot.teacherId || c.teacherId || null,
        teacherName: slot.teacherName || c.teacher || null,
        grade: c.grade,
        shift: c.shift,
        start: slot.start || '',
        end: slot.end || '',
        day,
      });
    }
  }
  return rows.sort((a, b) => String(a.start).localeCompare(String(b.start)));
}

export function weekSlotsByDay(classes, opts = {}) {
  const map = {};
  for (const day of SCHOOL_DAYS) map[day] = slotsForDay(classes, day, opts);
  return map;
}
