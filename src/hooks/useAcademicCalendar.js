import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { isFirebaseConfigured } from '../firebase/config';
import {
  defaultAcademicCalendar,
  mergeAcademicCalendar,
} from '../services/academicCalendar';
import { schoolSettingsRef } from '../services/schoolSite';

/** Live academic year / term lock settings from schoolSettings/main. */
export function useAcademicCalendar() {
  const [calendar, setCalendar] = useState(defaultAcademicCalendar);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setCalendar(defaultAcademicCalendar());
      setLoading(false);
      return undefined;
    }
    const unsub = onSnapshot(
      schoolSettingsRef(),
      (snap) => {
        setCalendar(snap.exists() ? mergeAcademicCalendar(snap.data()) : defaultAcademicCalendar());
        setLoading(false);
        setError(null);
      },
      () => {
        setCalendar(defaultAcademicCalendar());
        setLoading(false);
        setError('تعذّر تحميل إعدادات العام الدراسي.');
      },
    );
    return unsub;
  }, []);

  return { calendar, loading, error };
}
