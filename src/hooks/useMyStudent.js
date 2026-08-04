import { useMemo } from 'react';
import { where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useCollection, useLiveOrDemo } from './useFirestore';
import { demoStudents } from '../data/demo';

/**
 * Resolve the signed-in student's Firestore student document + id.
 */
export function useMyStudent() {
  const { profile } = useAuth();
  const uid = profile?.id || '__none__';

  const { data: rows, error, demo, loading } = useLiveOrDemo(
    'students',
    [where('studentUid', '==', uid)],
    [demoStudents[0]],
    uid,
  );

  const student = rows[0] || null;
  const studentId = student?.id || profile?.studentId || (demo ? 's1' : null);

  const enrolledPath = studentId ? `students/${studentId}/classes` : 'students/__none__/classes';
  const { data: enrolled } = useCollection(enrolledPath, [], studentId || '__none__');

  return {
    profile,
    student,
    studentId,
    enrolled: enrolled || [],
    error,
    demo,
    loading,
    displayName: profile?.name || student?.name || 'طالب',
    displayId: student?.displayId || profile?.displayId || null,
    gradeLabel: student?.grade || student?.stageLabel || null,
  };
}

/** Filter school announcements relevant to students. */
export function filterStudentAnnouncements(list, student) {
  const grade = (student?.grade || student?.stageLabel || '').trim();
  return (list || []).filter((a) => {
    if (a.status && a.status !== 'منشور') return false;
    const aud = String(a.audience || 'الجميع');
    if (aud === 'الجميع' || aud === 'الطلاب') return true;
    if (aud.includes('طالب')) return true;
    if (grade && aud.includes(grade.split('/')[0].trim())) return true;
    if (aud === 'أولياء الأمور' || aud === 'المعلّمون') return false;
    return true;
  });
}

export function useStudentClassIds(enrolled, demo) {
  return useMemo(() => {
    if (demo) return ['demo-class-0', 'demo-class-1', 'demo-class-4'];
    return (enrolled || []).map((e) => e.classId || e.id).filter(Boolean);
  }, [enrolled, demo]);
}
