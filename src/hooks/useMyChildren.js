import { where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useLiveOrDemo } from './useFirestore';
import { demoChildren } from '../data/demo';

/**
 * Children linked to the signed-in parent via `students.guardianUid`.
 */
export function useMyChildren() {
  const { profile } = useAuth();
  const uid = profile?.id || '__none__';
  const { data, error, demo, loading } = useLiveOrDemo(
    'students',
    [where('guardianUid', '==', uid)],
    demoChildren,
    uid,
  );

  const children = (data || []).map((c) => ({
    ...c,
    initial: c.initial || (c.name || '?').charAt(0),
    due: Number(c.balanceMinorUnits ?? c.dueMinorUnits ?? 0),
  }));

  return {
    profile,
    children,
    error,
    demo,
    loading,
    displayName: profile?.name || 'ولي الأمر',
  };
}

/** Announcements relevant to parents / children's grades. */
export function filterParentAnnouncements(list, children = []) {
  const grades = children.map((c) => (c.grade || '').split('/')[0].trim()).filter(Boolean);
  return (list || []).filter((a) => {
    if (a.status && a.status !== 'منشور') return false;
    const aud = String(a.audience || 'الجميع');
    if (aud === 'الجميع' || aud === 'أولياء الأمور' || aud.includes('ولي')) return true;
    if (aud === 'الطلاب' || aud === 'المعلّمون') return false;
    return grades.some((g) => g && aud.includes(g));
  });
}
