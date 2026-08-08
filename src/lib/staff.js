import { CURRENT_ACADEMIC_YEAR, shekelsToMinorUnits } from './constants';

/** أنواع وظائف المدرسة — مناسبة لسياق العمل اليومي (بما فيه غزة). */
export const STAFF_ROLE_TYPES = [
  { id: 'teacher', label: 'معلّم / معلّمة' },
  { id: 'accountant', label: 'محاسب / مالية' },
  { id: 'reception', label: 'استقبال / تسجيل' },
  { id: 'director', label: 'مديرة' },
  { id: 'admin', label: 'إدارة / سكرتارية' },
  { id: 'cleaner', label: 'نظافة' },
  { id: 'utilities', label: 'صيانة / طاقة / مرافق' },
  { id: 'guard', label: 'حراسة' },
  { id: 'other', label: 'أخرى' },
];

/**
 * Roles that already have (or get) a system login — pick from users list,
 * or create a new account when adding from الموظفون والأجور.
 */
export const PORTAL_STAFF_ROLE_TYPES = ['teacher', 'accountant', 'reception', 'director'];

export function isPortalStaffRole(roleType) {
  return PORTAL_STAFF_ROLE_TYPES.includes(roleType);
}

export const SALARY_TYPES = [
  { id: 'monthly', label: 'راتب شهري', legacy: 'راتب شهري' },
  { id: 'hourly', label: 'أجر بالساعة', legacy: 'أجر ساعة' },
  { id: 'daily', label: 'أجر يومي', legacy: 'راتب يومي' },
];

export const DISBURSEMENT_KINDS = [
  { id: 'salary', label: 'رواتب موظفين', icon: 'payments' },
  { id: 'advance', label: 'سلفة', icon: 'request_quote' },
  { id: 'shift', label: 'ورديات', icon: 'schedule' },
  { id: 'consumable', label: 'مستهلكات', icon: 'inventory_2' },
];

export const EXPENSE_CATEGORIES = [
  'مستهلكات', 'مرافق', 'طاقة وكهرباء', 'ماء', 'إيجار', 'صيانة',
  'قرطاسية', 'خدمات', 'اشتراكات', 'طوارئ / إغاثة', 'أخرى',
];

export function staffRoleLabel(roleType) {
  return STAFF_ROLE_TYPES.find((r) => r.id === roleType)?.label || roleType || '—';
}

export function salaryTypeLabel(salaryType, legacyType) {
  const found = SALARY_TYPES.find((s) => s.id === salaryType || s.legacy === legacyType || s.legacy === salaryType);
  return found?.label || legacyType || salaryType || '—';
}

/** Normalize legacy staff docs to the new shape for UI/compute. */
export function normalizeStaff(doc) {
  const salaryType = doc.salaryType
    || (doc.type === 'راتب يومي' || doc.type === 'أجر يومي' ? 'daily'
      : doc.type === 'أجر ساعة' || doc.type === 'أجر بالساعة' ? 'hourly'
        : 'monthly');
  return {
    ...doc,
    roleType: doc.roleType || 'other',
    jobTitleAr: doc.jobTitleAr || doc.role || '—',
    salaryType,
    monthlySalaryMinorUnits: doc.monthlySalaryMinorUnits
      ?? (salaryType === 'monthly' ? doc.baseMinorUnits : null),
    hourlyRateMinorUnits: doc.hourlyRateMinorUnits
      ?? (salaryType === 'hourly' ? doc.baseMinorUnits : null),
    dailyRateMinorUnits: doc.dailyRateMinorUnits
      ?? (salaryType === 'daily' ? doc.baseMinorUnits : null),
    hoursPerMonth: doc.hoursPerMonth ?? (salaryType === 'hourly' ? 160 : null),
    active: doc.active !== false,
  };
}

export function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function periodLabel(period) {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) return period || '—';
  const [y, m] = period.split('-');
  const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  return `${months[Number(m) - 1]} ${y}`;
}

export { CURRENT_ACADEMIC_YEAR, shekelsToMinorUnits };
