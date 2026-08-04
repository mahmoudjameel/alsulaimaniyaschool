import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';

/**
 * Subscribe to lessons for many class IDs (student homework / today).
 * Returns `{ [classId]: Lesson[] }`.
 */
export function useClassLessonsMap(classIds = []) {
  const [map, setMap] = useState({});
  const key = useMemo(() => (classIds || []).filter(Boolean).join(','), [classIds]);

  useEffect(() => {
    const ids = key ? key.split(',') : [];
    if (!isFirebaseConfigured || ids.length === 0) {
      setMap({});
      return undefined;
    }

    const unsubs = ids.map((id) => {
      const q = query(collection(db, 'classes', id, 'lessons'));
      return onSnapshot(
        q,
        (snap) => {
          const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          rows.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          setMap((prev) => ({ ...prev, [id]: rows }));
        },
        () => {
          setMap((prev) => ({ ...prev, [id]: [] }));
        },
      );
    });

    return () => unsubs.forEach((u) => u());
  }, [key]);

  return map;
}
