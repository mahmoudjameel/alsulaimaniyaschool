import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';

/**
 * Live class documents for many IDs — schedule, teacher, subject, etc.
 * Returns `{ [classId]: classDoc | null }`.
 */
export function useClassDocsMap(classIds = []) {
  const [map, setMap] = useState({});
  const key = useMemo(() => [...new Set((classIds || []).filter(Boolean))].sort().join(','), [classIds]);

  useEffect(() => {
    const ids = key ? key.split(',') : [];
    if (!isFirebaseConfigured || ids.length === 0) {
      setMap({});
      return undefined;
    }

    const unsubs = ids.map((id) =>
      onSnapshot(
        doc(db, 'classes', id),
        (snap) => {
          setMap((prev) => ({
            ...prev,
            [id]: snap.exists() ? { id: snap.id, ...snap.data() } : null,
          }));
        },
        () => setMap((prev) => ({ ...prev, [id]: null })),
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [key]);

  return map;
}
