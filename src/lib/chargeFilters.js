import { SECTION_OPTIONS } from './constants';
import { matchesStudentSearch } from './studentSearch';

export const CHARGE_SORT_OPTIONS = [
  { id: 'newest', label: 'الأحدث أولاً' },
  { id: 'oldest', label: 'الأقدم أولاً' },
  { id: 'student', label: 'اسم الطالب' },
  { id: 'stage', label: 'المرحلة' },
  { id: 'amount_desc', label: 'المبلغ (الأعلى)' },
  { id: 'amount_asc', label: 'المبلغ (الأدنى)' },
];

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

function sortCharges(list, sortId, studentMap) {
  const rows = [...list];
  const stageKey = (c) => {
    const { stageLabel, grade } = resolveChargeStage(c, studentMap);
    return stageLabel || grade || '';
  };
  const nameKey = (c) => String(c.student || c.studentName || '');

  switch (sortId) {
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
  sortId = 'newest',
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
      },
      search,
      ['type', 'method', 'status', 'period'],
    )) return false;
    if (!chargeMatchesStage(c, stageFilter, studentMap)) return false;
    if (!chargeMatchesSection(c, sectionFilter, studentMap)) return false;
    if (statusFilter !== 'الكل' && c.status !== statusFilter) return false;
    return true;
  });
  return sortCharges(filtered, sortId, studentMap);
}

/** Short Arabic label for table cell. */
export function formatChargeStageLabel(charge, studentMap) {
  const { stageLabel, grade, classSection } = resolveChargeStage(charge, studentMap);
  if (grade) return grade;
  if (stageLabel && classSection) return `${stageLabel} / ${classSection}`;
  return stageLabel || '—';
}
