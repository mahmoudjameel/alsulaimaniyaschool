import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { isFirebaseConfigured } from '../firebase/config';
import { defaultSchoolSite, schoolSettingsRef } from '../services/schoolSite';

/** Live school geofence settings (falls back to defaults). */
export function useSchoolSite() {
  const [site, setSite] = useState(defaultSchoolSite);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setSite(defaultSchoolSite());
      setLoading(false);
      return undefined;
    }
    const unsub = onSnapshot(
      schoolSettingsRef(),
      (snap) => {
        setSite(snap.exists() ? { ...defaultSchoolSite(), id: snap.id, ...snap.data() } : defaultSchoolSite());
        setLoading(false);
        setError(null);
      },
      () => {
        setSite(defaultSchoolSite());
        setLoading(false);
        setError('تعذّر تحميل إعدادات موقع المدرسة.');
      },
    );
    return unsub;
  }, []);

  return { site, loading, error };
}
