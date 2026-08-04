import { useMemo } from 'react';
import { orderBy, where } from 'firebase/firestore';
import { useLiveOrDemo } from './useFirestore';
import { demoTeacherProfiles } from '../data/demo';

/**
 * Teachers that can be assigned to a class.
 * Prefer Auth-linked accounts (users.role === 'teacher', id === uid)
 * so the teacher portal (`teacherId === profile.id`) actually unlocks.
 * Directory-only profiles (random addDoc ids) are listed but flagged.
 */
export function useAssignableTeachers() {
  const { data: profiles, demo } = useLiveOrDemo(
    'teacherProfiles',
    [orderBy('name', 'asc')],
    demoTeacherProfiles,
  );
  const { data: teacherUsers } = useLiveOrDemo(
    'users',
    [where('role', '==', 'teacher')],
    [],
  );

  const teachers = useMemo(() => {
    const byId = new Map();
    for (const u of teacherUsers || []) {
      byId.set(u.id, {
        id: u.id,
        name: u.name || 'معلّم',
        subject: u.title || u.subject || 'معلّم',
        login: true,
      });
    }
    for (const p of profiles || []) {
      const existing = byId.get(p.id);
      if (existing) {
        byId.set(p.id, {
          ...existing,
          name: p.name || existing.name,
          subject: p.subject || existing.subject,
          login: true,
        });
      } else {
        byId.set(p.id, {
          id: p.id,
          name: p.name || 'معلّم',
          subject: p.subject || '—',
          login: false,
        });
      }
    }
    return [...byId.values()].sort((a, b) => {
      if (a.login !== b.login) return a.login ? -1 : 1;
      return String(a.name).localeCompare(String(b.name), 'ar');
    });
  }, [profiles, teacherUsers]);

  return { teachers, demo };
}
