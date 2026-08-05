import {
  collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  geoErrorMessage,
  getDevicePosition,
  isWithinGeofence,
  localDateKey,
  periodFromDateKey,
  staffDayDocId,
} from '../lib/geo';
import { fetchSchoolSite } from './schoolSite';
import { setStaffAttendance } from './staff';
import { logActivity } from './activity';

export const staffAttendanceDaysCol = collection(db, 'staffAttendanceDays');

export function todayAttendanceRef(teacherUid, dateKey = localDateKey()) {
  return doc(db, 'staffAttendanceDays', staffDayDocId(teacherUid, dateKey));
}

export async function fetchTodayAttendance(teacherUid, dateKey = localDateKey()) {
  if (!teacherUid) return null;
  const snap = await getDoc(todayAttendanceRef(teacherUid, dateKey));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

async function requireSiteAndPosition() {
  const site = await fetchSchoolSite();
  if (!site.punchEnabled) {
    const err = new Error('SITE_DISABLED');
    err.code = 'SITE_DISABLED';
    throw err;
  }
  if (site.latitude == null || site.longitude == null) {
    const err = new Error('SITE_MISSING');
    err.code = 'SITE_MISSING';
    throw err;
  }
  const position = await getDevicePosition();
  const fence = isWithinGeofence(position, site);
  if (!fence.ok) {
    const err = new Error('OUTSIDE_GEOFENCE');
    err.code = 'OUTSIDE_GEOFENCE';
    err.distanceM = fence.distanceM;
    err.radius = fence.radius;
    throw err;
  }
  return { site, position, fence };
}

/**
 * Staff check-in (بصمة حضور) — teacher / accountant / reception — one per day.
 * `teacherUid` kept as the auth-uid field name for existing docs/indexes.
 */
export async function punchCheckIn({ teacherUid, teacherName, actor, staffRole }) {
  const uid = teacherUid || actor?.uid || actor?.id;
  if (!uid) {
    const err = new Error('NO_USER');
    err.code = 'NO_USER';
    throw err;
  }
  const role = staffRole || actor?.role || 'teacher';
  const dateKey = localDateKey();
  const period = periodFromDateKey(dateKey);
  const ref = todayAttendanceRef(uid, dateKey);

  // Resolve GPS + geofence first so location errors surface clearly.
  const { site, position, fence } = await requireSiteAndPosition();

  let existing = null;
  try {
    const snap = await getDoc(ref);
    existing = snap.exists() ? snap : null;
  } catch (e) {
    // Missing-doc read used to fail rules; treat as empty and continue to create.
    if (e?.code !== 'permission-denied') throw e;
  }
  if (existing?.exists() && existing.data().checkInAt) {
    const err = new Error('ALREADY_CHECKED_IN');
    err.code = 'ALREADY_CHECKED_IN';
    throw err;
  }

  const now = serverTimestamp();
  const displayName = teacherName || actor?.name || 'موظف';
  const payload = {
    teacherUid: uid,
    teacherName: displayName,
    staffRole: role,
    date: dateKey,
    period,
    checkInAt: now,
    checkInLat: position.lat,
    checkInLng: position.lng,
    checkInAccuracy: position.accuracy,
    checkInDistanceM: fence.distanceM,
    checkInWithinGeofence: true,
    checkOutAt: null,
    status: 'حاضر',
    siteLabel: site.locationLabelAr || null,
    siteRadiusM: fence.radius,
    updatedAt: now,
    createdAt: now,
  };

  try {
    if (existing?.exists()) {
      await updateDoc(ref, payload);
    } else {
      await setDoc(ref, payload);
    }
  } catch (e) {
    const err = new Error(e?.code || e?.message || 'WRITE_FAILED');
    err.code = e?.code || 'WRITE_FAILED';
    err.cause = e;
    throw err;
  }

  await syncPayrollDaysFromPunches(uid, period).catch(() => {});
  await logActivity({
    type: 'staff_check_in',
    actorUid: uid,
    actorName: displayName,
    actorRole: role,
    summary: `تسجيل حضور — ${displayName} (${dateKey})`,
    targetType: 'staffAttendanceDay',
    targetId: ref.id,
  }).catch(() => {});

  return { dateKey, distanceM: fence.distanceM };
}

/**
 * Staff check-out (بصمة انصراف) — requires prior check-in same day.
 */
export async function punchCheckOut({ teacherUid, teacherName, actor, staffRole }) {
  const uid = teacherUid || actor?.uid || actor?.id;
  if (!uid) {
    const err = new Error('NO_USER');
    err.code = 'NO_USER';
    throw err;
  }
  const role = staffRole || actor?.role || 'teacher';
  const dateKey = localDateKey();
  const period = periodFromDateKey(dateKey);
  const ref = todayAttendanceRef(uid, dateKey);

  const { site, position, fence } = await requireSiteAndPosition();

  let existing;
  try {
    existing = await getDoc(ref);
  } catch (e) {
    const err = new Error(e?.code || 'READ_FAILED');
    err.code = e?.code || 'READ_FAILED';
    throw err;
  }
  if (!existing.exists() || !existing.data().checkInAt) {
    const err = new Error('NEED_CHECK_IN');
    err.code = 'NEED_CHECK_IN';
    throw err;
  }
  if (existing.data().checkOutAt) {
    const err = new Error('ALREADY_CHECKED_OUT');
    err.code = 'ALREADY_CHECKED_OUT';
    throw err;
  }

  const displayName = teacherName || actor?.name || existing.data().teacherName || 'موظف';
  try {
    await updateDoc(ref, {
      checkOutAt: serverTimestamp(),
      checkOutLat: position.lat,
      checkOutLng: position.lng,
      checkOutAccuracy: position.accuracy,
      checkOutDistanceM: fence.distanceM,
      checkOutWithinGeofence: true,
      status: 'مكتمل',
      staffRole: role || existing.data().staffRole || null,
      siteLabel: site.locationLabelAr || existing.data().siteLabel || null,
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    const err = new Error(e?.code || e?.message || 'WRITE_FAILED');
    err.code = e?.code || 'WRITE_FAILED';
    throw err;
  }

  await syncPayrollDaysFromPunches(uid, period).catch(() => {});
  await logActivity({
    type: 'staff_check_out',
    actorUid: uid,
    actorName: displayName,
    actorRole: role,
    summary: `تسجيل انصراف — ${displayName} (${dateKey})`,
    targetType: 'staffAttendanceDay',
    targetId: ref.id,
  }).catch(() => {});

  return { dateKey, distanceM: fence.distanceM };
}

/**
 * Count days with check-in in a period and push into staff/{id}/attendance/{period}
 * when a staff row is linked via authUid.
 */
export async function syncPayrollDaysFromPunches(teacherUid, period) {
  if (!teacherUid || !period) return null;
  const daysSnap = await getDocs(query(
    staffAttendanceDaysCol,
    where('teacherUid', '==', teacherUid),
    where('period', '==', period),
  ));
  const daysPresent = daysSnap.docs.filter((d) => d.data().checkInAt).length;

  const staffSnap = await getDocs(query(
    collection(db, 'staff'),
    where('authUid', '==', teacherUid),
  ));
  if (staffSnap.empty) return { daysPresent, staffUpdated: 0 };

  let staffUpdated = 0;
  await Promise.all(staffSnap.docs.map(async (s) => {
    await setStaffAttendance(s.id, period, {
      daysPresent,
      workingDays: 22,
      hoursWorked: null,
    });
    staffUpdated += 1;
  }));
  return { daysPresent, staffUpdated };
}

export function punchErrorMessage(err) {
  const code = err?.code || err?.message;
  if (code === 'OUTSIDE_GEOFENCE' && err.distanceM != null) {
    return `${geoErrorMessage('OUTSIDE_GEOFENCE')} (المسافة الحالية ≈ ${err.distanceM} م · المسموح ${err.radius || '?'} م).`;
  }
  if (code === 'permission-denied' || code === 'WRITE_FAILED' || code === 'READ_FAILED') {
    return 'رُفض الحفظ في السجل الرسمي. تأكد من صلاحية حسابك ثم أعد المحاولة.';
  }
  if (code === 'unavailable' || code === 'network-request-failed') {
    return 'انقطع الاتصال. تحقق من الشبكة ثم أعد التسجيل.';
  }
  if (code === 'NO_USER') {
    return geoErrorMessage('NO_USER');
  }
  const mapped = geoErrorMessage(code);
  if (mapped !== 'لم يُقبل التسجيل. أعد المحاولة أو راجع الإدارة.') return mapped;
  if (code && typeof code === 'string' && code !== 'Error') {
    return `لم يُقبل التسجيل (${code}). راجع الإدارة إن تكرّر الأمر.`;
  }
  return 'لم يُقبل التسجيل. أعد المحاولة أو راجع الإدارة.';
}

/** Format Firestore timestamp or Date for display. */
export function formatPunchTime(ts) {
  if (!ts) return '—';
  let d;
  if (typeof ts.toDate === 'function') d = ts.toDate();
  else if (ts.seconds) d = new Date(ts.seconds * 1000);
  else d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}
