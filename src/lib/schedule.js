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

/** Flatten class.schedule slots for one weekday; sorted by start time. */
export function slotsForDay(classes, dayName) {
  const day = normalizeDay(dayName);
  const rows = [];
  for (const c of classes || []) {
    for (const slot of c.schedule || []) {
      if (normalizeDay(slot.day) === day) {
        rows.push({
          classId: c.id,
          title: c.title,
          subject: c.subject,
          grade: c.grade,
          shift: c.shift,
          start: slot.start || '',
          end: slot.end || '',
          day,
        });
      }
    }
  }
  return rows.sort((a, b) => String(a.start).localeCompare(String(b.start)));
}

export function weekSlotsByDay(classes) {
  const map = {};
  for (const day of SCHOOL_DAYS) map[day] = slotsForDay(classes, day);
  return map;
}
