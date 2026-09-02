import { useMemo } from 'react';
import { orderBy } from 'firebase/firestore';
import { useLiveOrDemo } from './useFirestore';
import {
  DEFAULT_TEACHING_SUBJECTS,
  subjectScheduleLabel,
} from '../services/teachingSubjects';

/**
 * Live catalog of teaching subjects (مواد التدريس).
 * @param {{ includeInactive?: boolean }} options
 */
export function useTeachingSubjects({ includeInactive = false } = {}) {
  const { data, demo, loading, error } = useLiveOrDemo(
    'teachingSubjects',
    [orderBy('order', 'asc')],
    DEFAULT_TEACHING_SUBJECTS,
  );

  const allSubjects = useMemo(
    () => [...(data || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [data],
  );

  const subjects = useMemo(
    () => (includeInactive ? allSubjects : allSubjects.filter((s) => s.active !== false)),
    [allSubjects, includeInactive],
  );

  const labels = useMemo(
    () => subjects.map((s) => subjectScheduleLabel(s)),
    [subjects],
  );

  const byId = useMemo(() => {
    const map = new Map();
    for (const s of allSubjects) {
      if (s?.id) map.set(s.id, s);
    }
    return map;
  }, [allSubjects]);

  return { subjects, allSubjects, labels, byId, demo, loading, error };
}
