/** Shared student/person text search — name, national ID, display ID, guardian. */

export function normalizeSearchQuery(query) {
  return String(query || '').trim().toLowerCase();
}

/** Digits-only form for national ID / school ID matching (ignores spaces/dashes). */
export function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

const STUDENT_FIELDS = [
  'name', 'studentName', 'student', 'nationalId', 'displayId',
  'guardianName', 'guardian', 'grade', 'stageLabel', 'guardianPhone',
];

export function matchesStudentSearch(record, query, extraFields = []) {
  const q = normalizeSearchQuery(query);
  if (!q) return true;
  if (!record) return false;

  const fields = [...STUDENT_FIELDS, ...extraFields];
  const textHit = fields.some((key) => {
    const v = record[key];
    return v != null && String(v).toLowerCase().includes(q);
  });
  if (textHit) return true;

  const qDigits = digitsOnly(q);
  if (qDigits.length >= 3) {
    return ['nationalId', 'displayId', 'id'].some((key) => {
      const d = digitsOnly(record[key]);
      return d && d.includes(qDigits);
    });
  }
  return false;
}

export function filterByStudentSearch(list, query, extraFields) {
  const q = normalizeSearchQuery(query);
  if (!q) return list || [];
  return (list || []).filter((item) => matchesStudentSearch(item, q, extraFields));
}

/** Teacher / staff name search. */
export function matchesTeacherSearch(record, query) {
  const q = normalizeSearchQuery(query);
  if (!q) return true;
  if (!record) return false;
  return ['name', 'subject', 'email', 'phone', 'title', 'bio']
    .some((key) => record[key] != null && String(record[key]).toLowerCase().includes(q));
}

export function filterByTeacherSearch(list, query) {
  const q = normalizeSearchQuery(query);
  if (!q) return list || [];
  return (list || []).filter((item) => matchesTeacherSearch(item, q));
}
