/** Canonical fee-type labels used across billing UIs and charge docs. */

export const SEAT_RESERVATION_TYPE = 'حجز مقعد';
export const MONTHLY_TUITION_TYPE = 'رسوم دراسية شهرية';
export const TUITION_TYPE = 'رسوم دراسية';

export const FEE_TYPE_OPTIONS = [
  SEAT_RESERVATION_TYPE,
  MONTHLY_TUITION_TYPE,
  TUITION_TYPE,
  'مواصلات',
  'زيّ مدرسي',
  'كتب ومستلزمات',
  'رسوم نشاط',
  'أخرى',
];

export function isSeatReservationType(type) {
  return String(type || '').trim() === SEAT_RESERVATION_TYPE;
}

export function isMonthlyTuitionType(type) {
  const t = String(type || '').trim();
  return t === MONTHLY_TUITION_TYPE || t === TUITION_TYPE;
}

/** Resolve stage seat fee (agorot) for a student from academicStages list. */
export function resolveSeatFeeMinorUnits(student, stages = []) {
  if (!student) return 0;
  const byId = stages.find((s) => s.id && s.id === student.stageId);
  if (byId?.seatReservationMinorUnits != null) {
    return Number(byId.seatReservationMinorUnits) || 0;
  }
  const label = student.stageLabel || String(student.grade || '').split('/')[0].trim();
  const byLabel = stages.find((s) => s.labelAr === label);
  return Number(byLabel?.seatReservationMinorUnits) || 0;
}

export function resolveMonthlyFeeMinorUnits(student, stages = []) {
  if (!student) return 0;
  const byId = stages.find((s) => s.id && s.id === student.stageId);
  if (byId?.monthlyTuitionMinorUnits != null) {
    return Number(byId.monthlyTuitionMinorUnits) || 0;
  }
  const label = student.stageLabel || String(student.grade || '').split('/')[0].trim();
  const byLabel = stages.find((s) => s.labelAr === label);
  return Number(byLabel?.monthlyTuitionMinorUnits) || 0;
}
