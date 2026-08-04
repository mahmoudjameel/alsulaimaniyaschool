import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import { demoEnrollments } from '../data/demo';

/**
 * Live enrollment headcounts per class (from classes/{id}/enrollments).
 * Prefer this over denormalized `students` / `studentsCount` on the class doc.
 */
export function useEnrollmentCounts(classIds) {
  const idsKey = useMemo(
    () => [...new Set((classIds || []).filter(Boolean))].sort().join(','),
    [classIds],
  );
  const ids = useMemo(() => (idsKey ? idsKey.split(',') : []), [idsKey]);
  const [counts, setCounts] = useState(() => ({}));

  useEffect(() => {
    if (ids.length === 0) {
      setCounts({});
      return undefined;
    }

    if (!isFirebaseConfigured) {
      const map = {};
      for (const id of ids) {
        map[id] = (demoEnrollments[id] || []).length;
      }
      setCounts(map);
      return undefined;
    }

    setCounts((prev) => {
      const next = {};
      for (const id of ids) {
        if (id in prev) next[id] = prev[id];
      }
      return next;
    });

    const unsubs = ids.map((id) =>
      onSnapshot(
        collection(db, 'classes', id, 'enrollments'),
        (snap) => setCounts((prev) => (prev[id] === snap.size ? prev : { ...prev, [id]: snap.size })),
        () => setCounts((prev) => ({ ...prev, [id]: 0 })),
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [ids, idsKey]);

  return counts;
}

/** Resolve display count: live enrollments first; demo may fall back to seed field. */
export function enrolledDisplayCount(classDoc, counts, { demo = false } = {}) {
  if (classDoc?.id && classDoc.id in counts) return counts[classDoc.id];
  if (demo) return Number(classDoc?.studentsCount ?? classDoc?.students ?? 0);
  return null;
}
