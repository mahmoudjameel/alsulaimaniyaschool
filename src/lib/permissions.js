// Central catalog of grantable permissions + each role's default set.
// Role `admin` always has every permission (enforced in permissionsForUser).
// Role `director` (مديرة) uses stored overrides like other staff roles.

export const PERMISSIONS = [
  { key: 'admissions.manage', label: 'القبول والتسجيل', group: 'الطلاب', description: 'مراجعة طلبات التسجيل وقبولها أو رفضها' },
  { key: 'students.manage', label: 'إدارة ملفات الطلاب', group: 'الطلاب', description: 'عرض وتعديل بيانات الطلاب وأولياء الأمور' },
  { key: 'stages.manage', label: 'المراحل الدراسية والرسوم', group: 'الطلاب', description: 'إدارة المراحل والشهرية لكل مرحلة' },
  { key: 'enrollment.manage', label: 'تسجيل الطلاب في الصفوف', group: 'الطلاب', description: 'إضافة الطلاب إلى الصفوف الدراسية' },
  { key: 'billing.manage', label: 'الفواتير والدفعات', group: 'المالية', description: 'إصدار الفواتير ومتابعة الأرصدة' },
  { key: 'payments.manage', label: 'وصول الدفع', group: 'المالية', description: 'مراجعة والموافقة على إيصالات التحويل' },
  { key: 'payroll.manage', label: 'الرواتب', group: 'المالية', description: 'حساب واعتماد وصرف رواتب الموظفين' },
  { key: 'staff.manage', label: 'الموظفون والأجور', group: 'المالية', description: 'إضافة الموظفين وتحديد الراتب والساعات ومتابعة الحضور' },
  { key: 'disbursements.manage', label: 'سلف وورديات ومستهلكات', group: 'المالية', description: 'تسجيل صرفيات غير الرواتب' },
  { key: 'expenses.manage', label: 'المصاريف', group: 'المالية', description: 'تسجيل ومتابعة مصاريف المدرسة' },
  { key: 'classes.manage', label: 'الصفوف والدروس', group: 'الأكاديمي', description: 'إدارة الصفوف والدروس والحضور' },
  { key: 'teachers.manage', label: 'دليل المعلّمين', group: 'الأكاديمي', description: 'ملفات المعلّمين الظاهرة للموقع' },
  { key: 'grades.approve', label: 'اعتماد الدرجات', group: 'الأكاديمي', description: 'مراجعة واعتماد درجات الطلاب' },
  { key: 'cms.manage', label: 'الموقع والمحتوى', group: 'الأكاديمي', description: 'المقالات والمحتوى العام للموقع' },
  { key: 'users.manage', label: 'المستخدمون والصلاحيات', group: 'النظام', description: 'دعوة المستخدمين ومنح الصلاحيات' },
  { key: 'system.backup', label: 'نسخ احتياطي ومسح', group: 'النظام', description: 'تنزيل النسخ الاحتياطية ومسح البيانات' },
  { key: 'activity.view', label: 'سجلّ الحركات', group: 'النظام', description: 'عرض سجل العمليات في النظام' },
];

export const ROLE_LABELS = {
  admin: 'الإدارة',
  director: 'المديرة',
  teacher: 'المعلّم',
  accountant: 'المحاسب',
  reception: 'الاستقبال',
  parent: 'ولي الأمر',
  student: 'الطالب',
};

/** Roles that use the admin shell (/admin). */
export const ADMIN_SHELL_ROLES = ['admin', 'director'];

/** Roles that get a staff portal + can be granted a subset of PERMISSIONS. */
export const STAFF_ROLES = ['admin', 'director', 'teacher', 'accountant', 'reception'];

/** Academic + student defaults for المديرة — no full finance, no users/backup. */
const DIRECTOR_DEFAULTS = {
  'admissions.manage': true,
  'students.manage': true,
  'stages.manage': true,
  'enrollment.manage': true,
  'classes.manage': true,
  'teachers.manage': true,
  'grades.approve': true,
  'cms.manage': true,
  'activity.view': true,
};

export const ROLE_DEFAULT_PERMISSIONS = {
  admin: Object.fromEntries(PERMISSIONS.map((p) => [p.key, true])),
  director: { ...DIRECTOR_DEFAULTS },
  accountant: {
    'billing.manage': true,
    'payments.manage': true,
    'expenses.manage': true,
    'enrollment.manage': true,
    'students.manage': true,
    'payroll.manage': true,
    'disbursements.manage': true,
    'staff.manage': true,
  },
  teacher: {
    'classes.manage': true,
  },
  reception: {
    'admissions.manage': true,
    'students.manage': true,
    'enrollment.manage': true,
  },
};

/** Effective permission map: stored overrides defaults (false revokes, true grants). */
export function permissionsForUser(profile) {
  if (!profile) return {};
  // Owner admin always has everything — cannot be restricted from the UI.
  if (profile.role === 'admin') return { ...ROLE_DEFAULT_PERMISSIONS.admin };
  const defaults = ROLE_DEFAULT_PERMISSIONS[profile.role] || {};
  const stored = profile.permissions || {};
  const out = { ...defaults };
  Object.keys(stored).forEach((key) => {
    out[key] = !!stored[key];
  });
  // Ensure every catalog key exists as boolean for checkbox UIs
  PERMISSIONS.forEach((p) => {
    if (out[p.key] == null) out[p.key] = false;
  });
  return out;
}

export function hasPermission(profile, key) {
  return !!permissionsForUser(profile)[key];
}

export function isAdminShellRole(role) {
  return ADMIN_SHELL_ROLES.includes(role);
}

/** Build a full true/false map for every known permission key. */
export function serializePermissions(permMap) {
  return Object.fromEntries(PERMISSIONS.map((p) => [p.key, !!permMap[p.key]]));
}

export function permissionGroups() {
  return [...new Set(PERMISSIONS.map((p) => p.group))];
}
