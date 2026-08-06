/**
 * Birth-date helpers (ISO `YYYY-MM-DD`) for admissions + student records.
 */

export function ageFromBirthDate(iso, asOf = new Date()) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(String(iso).trim())) return null;
  const [y, m, d] = String(iso).trim().split('-').map(Number);
  if (!y || !m || !d) return null;
  let age = asOf.getFullYear() - y;
  const month = asOf.getMonth() + 1;
  const day = asOf.getDate();
  if (month < m || (month === m && day < d)) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}

/** School ages typically 3–20. */
export function isPlausibleStudentBirthDate(iso) {
  const age = ageFromBirthDate(iso);
  return age != null && age >= 3 && age <= 20;
}

export function birthDateBounds() {
  const today = new Date();
  const max = new Date(today.getFullYear() - 3, today.getMonth(), today.getDate());
  const min = new Date(today.getFullYear() - 20, today.getMonth(), today.getDate());
  const toIso = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  return { min: toIso(min), max: toIso(max) };
}

/** Display like 2018-05-12 → ١٢ مايو ٢٠١٨ (simple numeric fallback). */
export function formatBirthDateDisplay(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-');
  if (!y || !m || !d) return String(iso);
  return `${d}/${m}/${y}`;
}
