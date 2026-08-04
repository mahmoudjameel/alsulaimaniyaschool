// Shared by the teacher's attendance sheet, the admin/parent-facing history
// views, and the printable report card — one source of truth for the
// status vocabulary and the daily→monthly rollup math.

export const ATTENDANCE_STATUSES = ['حاضر', 'غائب', 'متأخر', 'مستأذن'];

const MONTH_NAMES_AR = [
  'كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران',
  'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول',
];

export function monthLabelFromDate(dateStr) {
  const [y, m] = (dateStr || '').split('-').map(Number);
  if (!y || !m) return dateStr || '—';
  return `${MONTH_NAMES_AR[m - 1]} ${y}`;
}

/** Groups flat daily attendance records into the classic "الشهر / حضور /
 * غياب / تأخّر / النسبة" summary table, newest month first. */
export function computeMonthlyAttendance(records) {
  const byMonth = new Map();
  for (const r of records || []) {
    const key = (r.date || '').slice(0, 7); // 'YYYY-MM'
    if (!key) continue;
    if (!byMonth.has(key)) byMonth.set(key, { key, label: monthLabelFromDate(r.date), present: 0, absent: 0, late: 0, excused: 0, total: 0 });
    const bucket = byMonth.get(key);
    bucket.total += 1;
    if (r.status === 'حاضر') bucket.present += 1;
    else if (r.status === 'غائب') bucket.absent += 1;
    else if (r.status === 'متأخر') bucket.late += 1;
    else if (r.status === 'مستأذن') bucket.excused += 1;
  }
  return [...byMonth.values()]
    .sort((a, b) => b.key.localeCompare(a.key))
    .map((b) => ({ ...b, pct: b.total ? `${Math.round(((b.present + b.late) / b.total) * 100)}%` : '—' }));
}

/** Overall attendance rate (present + late count as "attended") across all records. */
export function computeAttendanceRate(records) {
  if (!records || records.length === 0) return null;
  const attended = records.filter((r) => r.status === 'حاضر' || r.status === 'متأخر').length;
  return Math.round((attended / records.length) * 100);
}
