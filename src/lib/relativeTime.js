export function relativeDaysAr(daysAgo) {
  if (daysAgo === 0) return 'اليوم';
  if (daysAgo === 1) return 'أمس';
  if (daysAgo === 2) return 'قبل يومين';
  if (daysAgo <= 10) return `قبل ${daysAgo} أيام`;
  return 'الأسبوع الماضي';
}

export function relativeHoursAr(hoursAgo) {
  if (hoursAgo < 1) return 'قبل دقائق';
  if (hoursAgo < 2) return 'قبل ساعة';
  if (hoursAgo < 24) return `قبل ${Math.round(hoursAgo)} ساعات`;
  const days = Math.round(hoursAgo / 24);
  return relativeDaysAr(days);
}

/** Accepts a Firestore Timestamp, JS Date, or ISO string and renders an
 * Arabic relative label ("قبل ساعة", "أمس", …). */
export function relativeFromTimestamp(value) {
  if (!value) return '';
  const date = value.toDate ? value.toDate() : new Date(value);
  const hours = (Date.now() - date.getTime()) / 36e5;
  return relativeHoursAr(hours);
}
