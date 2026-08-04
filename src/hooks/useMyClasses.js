import { useMemo } from 'react';
import { orderBy } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useLiveOrDemo } from './useFirestore';
import { demoClasses } from '../data/demo';

/** Classes assigned to the signed-in teacher (by teacherId === profile.id). */
export function useMyClasses() {
  const { profile } = useAuth();
  const live = useLiveOrDemo('classes', [orderBy('createdAt', 'desc')], demoClasses);
  const myClasses = useMemo(() => {
    if (!profile?.id) return live.data;
    const mine = live.data.filter((c) => c.teacherId === profile.id);
    // Demo / incomplete seed: if nothing matched, show all so the UI stays usable
    return mine.length > 0 || !live.demo ? mine : live.data;
  }, [live.data, live.demo, profile?.id]);
  return { myClasses, profile, ...live };
}
