import { useMemo } from 'react';
import { orderBy } from 'firebase/firestore';
import { useLiveOrDemo } from './useFirestore';
import { DEFAULT_ACADEMIC_STAGES } from '../services/stages';

/** Active academic stages (admin-managed), falling back to defaults in demo. */
export function useAcademicStages() {
  const { data, demo, loading, error } = useLiveOrDemo(
    'academicStages',
    [orderBy('order', 'asc')],
    DEFAULT_ACADEMIC_STAGES,
  );
  const stages = useMemo(
    () => (data || []).filter((s) => s.active !== false).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [data],
  );
  const labels = useMemo(() => stages.map((s) => s.labelAr), [stages]);
  return { stages, labels, demo, loading, error };
}
