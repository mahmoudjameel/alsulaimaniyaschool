import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';

/**
 * Today's day-log doc per class: `classes/{id}/dayLogs/{YYYY-MM-DD}`.
 * Returns `{ [classId]: dayLog | null }`.
 */
export function useTodayDayLogsMap(classIds = [], dateStr) {
  const [map, setMap] = useState({});
  const key = useMemo(() => [...new Set((classIds || []).filter(Boolean))].sort().join(','), [classIds]);

  useEffect(() => {
    const ids = key ? key.split(',') : [];
    if (!isFirebaseConfigured || !dateStr || ids.length === 0) {
      setMap({});
      return undefined;
    }

    const unsubs = ids.map((id) =>
      onSnapshot(
        doc(db, 'classes', id, 'dayLogs', dateStr),
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
  }, [key, dateStr]);

  return map;
}

/**
 * Recent day-logs per class (for homework / notices history).
 * Returns `{ [classId]: DayLog[] }` newest first.
 */
export function useClassDayLogsMap(classIds = []) {
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
        query(collection(db, 'classes', id, 'dayLogs'), orderBy('date', 'desc')),
        (snap) => {
          const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setMap((prev) => ({ ...prev, [id]: rows }));
        },
        () => setMap((prev) => ({ ...prev, [id]: [] })),
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [key]);

  return map;
}
