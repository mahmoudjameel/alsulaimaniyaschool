import { SECTION_OPTIONS } from './constants';
import { matchesStudentSearch } from './studentSearch';
import { periodToLabelAr } from './billingPeriods';
import { isMonthlyTuitionType, isSeatReservationType } from './feeTypes';

export const CHARGE_SORT_OPTIONS = [
  { id: 'period_asc', label: 'الشهر (أيلول → حزيران)' },
  { id: 'period_desc', label: 'الشهر (الأحدث)' },
  { id: 'newest', label: 'الأحدث أولاً' },
  { id: 'oldest', label: 'الأقدم أولاً' },
  { id: 'student', label: 'اسم الطالب' },
  { id: 'stage', label: 'المرحلة' },
  { id: 'amount_desc', label: 'المبلغ (الأعلى)' },
  { id: 'amount_asc', label: 'المبلغ (الأدنى)' },
];

/** Display month for a charge: periodLabel or derived from period. */
export function formatChargePeriodLabel(charge) {
  if (!charge) return '';
  if (charge.periodLabel) return String(charge.periodLabel);
  if (charge.period) return periodToLabelAr(charge.period);
  return '';
}

/**
 * Human label for invoice tables:
 * monthly → «رسوم شهر أيلول 2026», seat → type, else type.
 */
export function formatChargeTypeLabel(charge) {
  if (!charge) return '—';
  const period = formatChargePeriodLabel(charge);
  const type = String(charge.type || '').trim();
  if (period && (isMonthlyTuitionType(type) || /رسوم/.test(type))) {
    return `رسوم شهر ${period}`;
  }
  if (isSeatReservationType(type)) return type || 'حجز مقعد';
  if (period && type) return `${type} · ${period}`;
  return type || period || '—';
}

export { SECTION_OPTIONS as CHARGE_SECTION_OPTIONS };

/** Build studentId → student lookup for joining stage onto charges. */
export function studentsByIdMap(students = []) {
  const map = new Map();
  for (const s of students) {
    if (s?.id) map.set(s.id, s);
  }
  return map;
}

/**
 * Resolve stage/grade/section for a charge — prefers denormalized fields,
 * falls back to linked student record (manual / installment charges).
 */
export function resolveChargeStage(charge, studentMap) {
  const student = charge?.studentId ? studentMap?.get(charge.studentId) : null;
  const stageLabel = charge?.stageLabel || student?.stageLabel || null;
  const stageId = charge?.stageId || student?.stageId || null;
  const grade = charge?.grade || student?.grade || stageLabel || '';
  const classSection = charge?.classSection || student?.classSection || null;
  return { stageId, stageLabel, grade, classSection, student };
}

export function chargeMatchesStage(charge, stageFilter, studentMap) {
  if (!stageFilter || stageFilter === 'الكل') return true;
  const { stageLabel, grade, stageId } = resolveChargeStage(charge, studentMap);
  if (stageId && stageFilter === stageId) return true;

  const texts = [stageLabel, grade].filter(Boolean).map(String);
  if (!texts.length) return false;

  const filterCore = stageFilter.replace(/\s*الأساسي\s*$/u, '').trim();
  return texts.some((hay) => {
    if (hay === stageFilter || hay.startsWith(stageFilter)) return true;
    const hayCore = hay.split(/[/\\]/)[0].trim().replace(/\s*الأساسي\s*$/u, '').trim();
    return (
      hayCore === stageFilter
      || hayCore === filterCore
      || (filterCore && hayCore.startsWith(filterCore))
      || (hayCore && stageFilter.startsWith(hayCore))
    );
  });
}

export function chargeMatchesSection(charge, sectionFilter, studentMap) {
  if (!sectionFilter || sectionFilter === 'الكل') return true;
  const { classSection, grade } = resolveChargeStage(charge, studentMap);
  if (classSection === sectionFilter) return true;
  // grade often looks like "الخامس / أ"
  const m = String(grade || '').match(/[/\\]\s*([أ-يA-Za-z0-9]+)\s*$/);
  return m ? m[1] === sectionFilter : false;
}

function createdAtMs(c) {
  const t = c?.createdAt;
  if (!t) return 0;
  if (typeof t.toMillis === 'function') return t.toMillis();
  if (typeof t.seconds === 'number') return t.seconds * 1000;
  const d = Date.parse(t);
  return Number.isFinite(d) ? d : 0;
}

function amountOf(c) {
  if (c?.amountMinorUnits != null) return Number(c.amountMinorUnits) || 0;
  const raw = String(c?.amount || '').replace(/[^\d.]/g, '');
  return Math.round(Number(raw || 0) * 100);
}

function periodKey(c) {
  return String(c?.period || '') || '9999-99';
}

/** Academic-year order: Sep→Jun then by student name. */
function compareAcademicPeriod(a, b) {
  const pa = periodKey(a);
  const pb = periodKey(b);
  if (pa === pb) return 0;
  const [ya, ma] = pa.split('-').map(Number);
  const [yb, mb] = pb.split('-').map(Number);
  const rank = (y, m) => (m >= 9 ? y * 100 + m : (y - 1) * 100 + (m + 12));
  return rank(ya || 0, ma || 0) - rank(yb || 0, mb || 0);
}

function sortCharges(list, sortId, studentMap) {
  const rows = [...list];
  const stageKey = (c) => {
    const { stageLabel, grade } = resolveChargeStage(c, studentMap);
    return stageLabel || grade || '';
  };
  const nameKey = (c) => String(c.student || c.studentName || '');

  switch (sortId) {
    case 'period_asc':
      return rows.sort((a, b) => {
        const p = compareAcademicPeriod(a, b);
        return p !== 0 ? p : nameKey(a).localeCompare(nameKey(b), 'ar');
      });
    case 'period_desc':
      return rows.sort((a, b) => {
        const p = compareAcademicPeriod(b, a);
        return p !== 0 ? p : nameKey(a).localeCompare(nameKey(b), 'ar');
      });
    case 'oldest':
      return rows.sort((a, b) => createdAtMs(a) - createdAtMs(b));
    case 'student':
      return rows.sort((a, b) => nameKey(a).localeCompare(nameKey(b), 'ar'));
    case 'stage':
      return rows.sort((a, b) => {
        const s = stageKey(a).localeCompare(stageKey(b), 'ar');
        return s !== 0 ? s : nameKey(a).localeCompare(nameKey(b), 'ar');
      });
    case 'amount_desc':
      return rows.sort((a, b) => amountOf(b) - amountOf(a));
    case 'amount_asc':
      return rows.sort((a, b) => amountOf(a) - amountOf(b));
    case 'newest':
    default:
      return rows.sort((a, b) => createdAtMs(b) - createdAtMs(a));
  }
}

/**
 * Filter + sort charges for admin/accountant invoice tables.
 */
export function filterAndSortCharges(charges, {
  search = '',
  stageFilter = 'الكل',
  sectionFilter = 'الكل',
  statusFilter = 'الكل',
  periodFilter = 'الكل',
  sortId = 'period_asc',
  students = [],
} = {}) {
  const studentMap = studentsByIdMap(students);
  const filtered = (charges || []).filter((c) => {
    const resolved = resolveChargeStage(c, studentMap);
    if (!matchesStudentSearch(
      {
        ...c,
        name: c.student || c.studentName,
        studentName: c.student || c.studentName,
        grade: resolved.grade,
        stageLabel: resolved.stageLabel,
        periodLabel: formatChargePeriodLabel(c),
      },
      search,
      ['type', 'method', 'status', 'period', 'periodLabel'],
    )) return false;
    if (!chargeMatchesStage(c, stageFilter, studentMap)) return false;
    if (!chargeMatchesSection(c, sectionFilter, studentMap)) return false;
    if (statusFilter !== 'الكل' && c.status !== statusFilter) return false;
    if (periodFilter && periodFilter !== 'الكل') {
      const p = c.period || '';
      const label = formatChargePeriodLabel(c);
      if (p !== periodFilter && label !== periodFilter) return false;
    }
    return true;
  });
  return sortCharges(filtered, sortId, studentMap);
}

/** Unique periods present in charges, academic order. */
export function uniqueChargePeriods(charges = []) {
  const map = new Map();
  for (const c of charges) {
    const key = c.period || formatChargePeriodLabel(c);
    if (!key) continue;
    if (!map.has(key)) map.set(key, formatChargePeriodLabel(c) || key);
  }
  return [...map.entries()]
    .sort((a, b) => compareAcademicPeriod({ period: a[0] }, { period: b[0] }))
    .map(([value, label]) => ({ value, label }));
}

/** Short Arabic label for table cell. */
export function formatChargeStageLabel(charge, studentMap) {
  const { stageLabel, grade, classSection } = resolveChargeStage(charge, studentMap);
  if (grade) return grade;
  if (stageLabel && classSection) return `${stageLabel} / ${classSection}`;
  return stageLabel || '—';
}
