import { CURRENT_ACADEMIC_YEAR } from './constants';

/** Number of tuition installments per academic year (Sep → Jun). */
export const ACADEMIC_TUITION_MONTHS = 10;

export const MONTH_LABELS_AR = {
  1: 'كانون الثاني',
  2: 'شباط',
  3: 'آذار',
  4: 'نيسان',
  5: 'أيار',
  6: 'حزيران',
  9: 'أيلول',
  10: 'تشرين الأول',
  11: 'تشرين الثاني',
  12: 'كانون الأول',
};

/** `2026-09` → `أيلول 2026` */
export function periodToLabelAr(period) {
  const raw = String(period || '').trim();
  if (!/^\d{4}-\d{2}$/.test(raw)) return raw;
  const [ys, ms] = raw.split('-');
  const month = Number(ms);
  const year = Number(ys);
  return `${MONTH_LABELS_AR[month] || ms} ${year}`;
}

/** Sep→Jun month numbers (crosses calendar year). */
const TUITION_MONTH_ORDER = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6];

/** Parse "2026 / 2027" → starting calendar year (autumn). */
export function academicYearStartYear(academicYear = CURRENT_ACADEMIC_YEAR) {
  const m = String(academicYear || '').match(/(\d{4})/);
  if (m) return Number(m[1]);
  const now = new Date();
  // Before September, academic year started previous calendar year
  return now.getMonth() + 1 >= 9 ? now.getFullYear() : now.getFullYear() - 1;
}

/**
 * Ten billing periods for the academic year.
 * @returns {{ period: string, year: number, month: number, labelAr: string }[]}
 */
export function academicTuitionPeriods(academicYear = CURRENT_ACADEMIC_YEAR) {
  const startYear = academicYearStartYear(academicYear);
  return TUITION_MONTH_ORDER.map((month) => {
    const year = month >= 9 ? startYear : startYear + 1;
    const period = `${year}-${String(month).padStart(2, '0')}`;
    return {
      period,
      year,
      month,
      labelAr: `${MONTH_LABELS_AR[month] || month} ${year}`,
    };
  });
}

export function tuitionPlanTotals(monthlyMinorUnits, seatMinorUnits = 0) {
  const monthly = Number(monthlyMinorUnits) || 0;
  const seat = Number(seatMinorUnits) || 0;
  const months = ACADEMIC_TUITION_MONTHS;
  const tuitionTotal = monthly * months;
  return {
    months,
    monthlyMinorUnits: monthly,
    seatMinorUnits: seat,
    tuitionTotalMinorUnits: tuitionTotal,
    grandTotalMinorUnits: tuitionTotal + seat,
  };
}
