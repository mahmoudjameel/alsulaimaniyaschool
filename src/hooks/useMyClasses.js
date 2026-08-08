import { useMemo } from 'react';
import { orderBy } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useLiveOrDemo } from './useFirestore';
import { demoClasses } from '../data/demo';
import { classHasTeacher } from '../lib/classForm';

/** Classes where the signed-in teacher is assigned (class-level or any schedule slot). */
export function useMyClasses() {
  const { profile } = useAuth();
  const live = useLiveOrDemo('classes', [orderBy('createdAt', 'desc')], demoClasses);
  const myClasses = useMemo(() => {
    if (!profile?.id) return live.demo ? live.data : [];
    const mine = live.data.filter((c) => classHasTeacher(c, profile.id));
    // Demo only: if seed has no match, show sample classes so the UI is usable offline.
    if (mine.length === 0 && live.demo) return live.data;
    return mine;
  }, [live.data, live.demo, profile?.id]);
  return { myClasses, profile, ...live };
}
