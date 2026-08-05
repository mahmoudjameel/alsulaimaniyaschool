import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  DEFAULT_GEOFENCE_RADIUS_M,
  DEFAULT_SCHOOL_LAT,
  DEFAULT_SCHOOL_LNG,
} from '../lib/geo';
import { SCHOOL_LOCATION_AR, SCHOOL_NAME_AR } from '../lib/constants';

export const SCHOOL_SETTINGS_DOC = 'main';

export function schoolSettingsRef() {
  return doc(db, 'schoolSettings', SCHOOL_SETTINGS_DOC);
}

/** Defaults used when Firestore doc is missing (demo + first run). */
export function defaultSchoolSite() {
  return {
    id: SCHOOL_SETTINGS_DOC,
    nameAr: SCHOOL_NAME_AR,
    locationLabelAr: SCHOOL_LOCATION_AR,
    latitude: DEFAULT_SCHOOL_LAT,
    longitude: DEFAULT_SCHOOL_LNG,
    radiusMeters: DEFAULT_GEOFENCE_RADIUS_M,
    punchEnabled: true,
    workdayStart: '07:30',
    workdayEnd: '14:00',
    notes: '',
  };
}

export async function fetchSchoolSite() {
  const snap = await getDoc(schoolSettingsRef());
  if (!snap.exists()) return defaultSchoolSite();
  return { ...defaultSchoolSite(), id: snap.id, ...snap.data() };
}

export async function saveSchoolSite(payload, actor) {
  const lat = Number(payload.latitude);
  const lng = Number(payload.longitude);
  const radius = Number(payload.radiusMeters);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('INVALID_COORDS');
  }
  if (!Number.isFinite(radius) || radius < 30 || radius > 2000) {
    throw new Error('INVALID_RADIUS');
  }
  await setDoc(schoolSettingsRef(), {
    nameAr: (payload.nameAr || SCHOOL_NAME_AR).trim(),
    locationLabelAr: (payload.locationLabelAr || SCHOOL_LOCATION_AR).trim(),
    latitude: lat,
    longitude: lng,
    radiusMeters: Math.round(radius),
    punchEnabled: payload.punchEnabled !== false,
    workdayStart: payload.workdayStart || '07:30',
    workdayEnd: payload.workdayEnd || '14:00',
    notes: (payload.notes || '').trim() || null,
    updatedAt: serverTimestamp(),
    updatedBy: actor?.uid || null,
    updatedByName: actor?.name || null,
  }, { merge: true });
}
