// Central place for cross-cutting constants shared by the client app,
// the seed script, and the Cloud Functions.

export const SCHOOL_NAME_AR = 'مدرسة السليمانية';
export const SCHOOL_NAME_EN = 'AL-SULAIMANIYA SCHOOL';
/** مدرسة خاصة في حي الرمال — غزة، فلسطين */
export const SCHOOL_TYPE_AR = 'مدرسة خاصة';
export const SCHOOL_CITY_AR = 'غزة';
export const SCHOOL_NEIGHBORHOOD_AR = 'الرمال';
export const SCHOOL_COUNTRY_AR = 'فلسطين';
export const SCHOOL_LOCATION_AR = 'غزة، الرمال — فلسطين';
export const SCHOOL_TAGLINE_AR = 'مدرسة خاصة · غزة، الرمال — فلسطين';
export const SCHOOL_EMAIL_DOMAIN = 'sulaimaniya.ps';

// Firebase Auth requires an email identifier. Students sign in with a
// study ID ("STU-1042") in the UI, so we map that to a synthetic address
// in a reserved sub-domain that never collides with real staff/parent email.
export const STUDENT_AUTH_EMAIL_DOMAIN = 'students.sulaimaniya.local';
export const studentIdToAuthEmail = (studentId) =>
  `${studentId.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')}@${STUDENT_AUTH_EMAIL_DOMAIN}`;

export const ROLES = ['admin', 'director', 'teacher', 'accountant', 'reception', 'parent', 'student'];


/** Show parent + student portals on launcher/login. */
export const SHOW_FAMILY_PORTALS = true;

export const GRADE_OPTIONS = [
  'الروضة', 'التمهيدي', 'الأول الأساسي', 'الثاني الأساسي', 'الثالث الأساسي',
  'الرابع الأساسي', 'الخامس الأساسي', 'السادس الأساسي',
];

/** Section letters within a stage (الصف / الشعبة). */
export const SECTION_OPTIONS = ['أ', 'ب', 'ج', 'د'];

/** ولي الأمر — حالة العمل عند التسجيل */
export const GUARDIAN_WORK_STATUS_OPTIONS = ['يعمل', 'لا يعمل'];

/** ولي الأمر — نوع السكن */
export const HOUSING_TYPE_OPTIONS = ['ملك', 'إيجار', 'مع الأهل', 'أخرى'];

export const CURRENT_ACADEMIC_YEAR = '2026 / 2027';

/** Compose a four-part Arabic full name; blanks are skipped. */
export function composeFullName({ nameFirst, nameFather, nameGrandfather, nameFamily }) {
  return [nameFirst, nameFather, nameGrandfather, nameFamily].map((p) => (p || '').trim()).filter(Boolean).join(' ');
}

/** Display grade label: stage + optional section. */
export function formatGradeLabel(stageLabel, classSection) {
  if (!stageLabel) return '';
  return classSection ? `${stageLabel} / ${classSection}` : stageLabel;
}

// Amounts are stored in Firestore as integer agorot (1/100 ILS) so money
// never touches floating point. This formats minor units for display.
export const formatILS = (minorUnits) => {
  if (minorUnits == null) return '—';
  const shekels = minorUnits / 100;
  const formatted = shekels.toLocaleString('en-US', {
    minimumFractionDigits: shekels % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `₪ ${formatted}`;
};

export const shekelsToMinorUnits = (shekels) => Math.round(Number(shekels || 0) * 100);
