/** Official school copy for staff attendance (punch) screens — concise, institutional. */

export const PUNCH_STATUS = {
  none: 'غير مسجّل',
  in: 'حاضر',
  done: 'مكتمل',
};

export function punchPageCopy(roleKicker = 'الهيئة الإدارية') {
  return {
    roleKicker,
    title: 'تسجيل الحضور والانصراف',
    lead: 'يُسجَّل الحضور عند الدخول إلى حرم المدرسة، والانصراف عند المغادرة. التسجيل مقبول داخل النطاق الجغرافي المعتمد فقط.',
    siteTitle: 'موقع التسجيل المعتمد',
    radiusLabel: (m) => `نصف القطر المسموح: ${m} م`,
    hoursLabel: (start, end) => `وقت الدوام الرسمي: من ${start} إلى ${end}`,
    dayLogTitle: (dateKey) => `سجلّ اليوم — ${formatPunchDateAr(dateKey)}`,
    gpsNote: 'فعّل خدمة الموقع في الجهاز واسمح للمتصفح بالوصول إليها قبل التسجيل.',
    disabledNote: 'إيقاف مؤقت من الإدارة — راجع مكتب الشؤون الإدارية.',
  };
}

export function punchCardCopy(site) {
  const place = site?.locationLabelAr || 'حرم المدرسة';
  const radius = site?.radiusMeters ?? 200;
  return {
    kicker: 'سجلّ الدوام',
    title: 'حضور وانصراف اليوم',
    hint: site?.punchEnabled === false
      ? 'إيقاف مؤقت من الإدارة — راجع مكتب الشؤون الإدارية.'
      : `يُقبل التسجيل داخل نطاق ${radius} م — ${place}.`,
    btnIn: 'تسجيل حضور',
    btnOut: 'تسجيل انصراف',
    details: 'عرض السجل',
    timeIn: 'الحضور',
    timeOut: 'الانصراف',
  };
}

export function formatPunchDateAr(dateKey) {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return dateKey || '—';
  const [y, m, d] = dateKey.split('-');
  return `${d}/${m}/${y}`;
}

export function punchSuccessMessage(kind, distanceM) {
  const dist = distanceM != null ? ` · المسافة عن المركز ${distanceM} م` : '';
  if (kind === 'in') return `سُجّل الحضور في السجل الرسمي${dist}.`;
  return `سُجّل الانصراف في السجل الرسمي${dist}.`;
}
