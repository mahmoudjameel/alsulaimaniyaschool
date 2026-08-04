import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import { demoEnrollments } from '../data/demo';
import { useMyClasses } from './useMyClasses';

/**
 * All students enrolled in the signed-in teacher's classes (deduped).
 * Each row includes `classes[]` — the teacher's classes this student belongs to.
 */
export function useMyStudents() {
  const { myClasses, profile, error, demo } = useMyClasses();
  const classIds = useMemo(() => myClasses.map((c) => c.id).filter(Boolean), [myClasses]);
  const idsKey = classIds.slice().sort().join(',');
  const [byClass, setByClass] = useState(() => ({}));

  useEffect(() => {
    if (classIds.length === 0) {
      setByClass({});
      return undefined;
    }

    if (!isFirebaseConfigured) {
      const map = {};
      for (const id of classIds) {
        map[id] = (demoEnrollments[id] || []).map((e) => ({
          ...e,
          studentId: e.studentId || e.id,
        }));
      }
      setByClass(map);
      return undefined;
    }

    const unsubs = classIds.map((id) =>
      onSnapshot(
        query(collection(db, 'classes', id, 'enrollments'), orderBy('enrolledAt', 'asc')),
        (snap) => {
          const rows = snap.docs.map((d) => {
            const data = d.data() || {};
            return {
              id: d.id,
              ...data,
              studentId: data.studentId || d.id,
            };
          });
          setByClass((prev) => (prev[id] === rows ? prev : { ...prev, [id]: rows }));
        },
        () => setByClass((prev) => ({ ...prev, [id]: [] })),
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [idsKey]); // eslint-disable-line react-hooks/exhaustive-deps -- idsKey tracks classIds

  const students = useMemo(() => {
    const map = new Map();
    for (const cls of myClasses) {
      const enrolled = byClass[cls.id] || [];
      for (const e of enrolled) {
        const sid = e.studentId || e.id;
        if (!sid) continue;
        const existing = map.get(sid);
        const classRef = {
          id: cls.id,
          title: cls.title,
          subject: cls.subject,
          grade: cls.grade,
          shift: cls.shift,
        };
        if (existing) {
          if (!existing.classes.some((c) => c.id === cls.id)) {
            existing.classes.push(classRef);
          }
        } else {
          map.set(sid, {
            studentId: sid,
            name: e.studentName || e.name || 'طالب',
            displayId: e.displayId || '',
            grade: e.grade || cls.grade || '',
            classes: [classRef],
          });
        }
      }
    }
    return [...map.values()].sort((a, b) => String(a.name).localeCompare(String(b.name), 'ar'));
  }, [myClasses, byClass]);

  return { students, myClasses, profile, error, demo, loading: classIds.length > 0 && Object.keys(byClass).length === 0 && !demo };
}
