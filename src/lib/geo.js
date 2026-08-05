/** Geolocation helpers for staff check-in / check-out geofencing. */

/** Approximate Al-Rimal, Gaza — admin overrides via schoolSettings. */
export const DEFAULT_SCHOOL_LAT = 31.5221;
export const DEFAULT_SCHOOL_LNG = 34.4442;
export const DEFAULT_GEOFENCE_RADIUS_M = 200;

/** Haversine distance in meters between two WGS84 points. */
export function distanceMeters(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lng2 - lng1);
  const a = Math.sin(Δφ / 2) ** 2
    + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function isWithinGeofence({ lat, lng }, site) {
  if (site?.latitude == null || site?.longitude == null) return { ok: false, distanceM: null };
  const distanceM = distanceMeters(lat, lng, Number(site.latitude), Number(site.longitude));
  const radius = Number(site.radiusMeters) || DEFAULT_GEOFENCE_RADIUS_M;
  return { ok: distanceM <= radius, distanceM: Math.round(distanceM), radius };
}

/**
 * Request current browser position. Rejects with Arabic-friendly codes.
 * @returns {Promise<{ lat: number, lng: number, accuracy: number|null }>}
 */
export function getDevicePosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('GEO_UNSUPPORTED'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy != null ? Math.round(pos.coords.accuracy) : null,
        });
      },
      (err) => {
        if (err?.code === 1) reject(new Error('GEO_DENIED'));
        else if (err?.code === 2) reject(new Error('GEO_UNAVAILABLE'));
        else if (err?.code === 3) reject(new Error('GEO_TIMEOUT'));
        else reject(new Error('GEO_FAILED'));
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
        ...options,
      },
    );
  });
}

export function geoErrorMessage(code) {
  switch (code) {
    case 'GEO_UNSUPPORTED':
      return 'الجهاز أو المتصفح لا يدعم تحديد الموقع. استخدم جوالاً حديثاً داخل الحرم.';
    case 'GEO_DENIED':
      return 'لم يُسمح بالوصول للموقع. اسمح للمتصفح ثم أعد التسجيل من داخل المدرسة.';
    case 'GEO_UNAVAILABLE':
      return 'تعذّر قراءة الموقع. فعّل خدمة الموقع وحاول من ساحة المدرسة.';
    case 'GEO_TIMEOUT':
      return 'انتهت مهلة تحديد الموقع. أعد المحاولة في مكان مكشوف داخل الحرم.';
    case 'OUTSIDE_GEOFENCE':
      return 'التسجيل مرفوض: أنت خارج النطاق الجغرافي المعتمد للمدرسة.';
    case 'ALREADY_CHECKED_IN':
      return 'حضور هذا اليوم مسجّل مسبقاً في السجل الرسمي.';
    case 'NEED_CHECK_IN':
      return 'لا يمكن تسجيل الانصراف قبل تثبيت الحضور.';
    case 'ALREADY_CHECKED_OUT':
      return 'انصراف هذا اليوم مسجّل مسبقاً في السجل الرسمي.';
    case 'SITE_DISABLED':
      return 'نظام تسجيل الدوام موقّف مؤقتاً بقرار الإدارة.';
    case 'SITE_MISSING':
      return 'لم يُعتمد موقع التسجيل بعد. راجع مكتب الشؤون الإدارية.';
    case 'NO_USER':
      return 'انتهت جلسة الدخول. سجّل الدخول من جديد ثم أعد التسجيل.';
    default:
      return 'لم يُقبل التسجيل. أعد المحاولة أو راجع الإدارة.';
  }
}

/** Local calendar date YYYY-MM-DD in Asia/Gaza-ish (device local). */
export function localDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function periodFromDateKey(dateKey) {
  return String(dateKey || '').slice(0, 7);
}

export function staffDayDocId(teacherUid, dateKey) {
  return `${teacherUid}_${dateKey}`;
}
