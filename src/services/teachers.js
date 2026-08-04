import { addDoc, collection, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export const teacherProfilesCol = collection(db, 'teacherProfiles');

/** Admin-only directory entry — separate from `staff` (which holds payroll
 * data) on purpose, so the public site / parent portal can read a teacher's
 * name, subject, and bio without ever touching salary information. */
export async function createTeacherProfile({ name, subject, bio, email, phone }) {
  const ref = await addDoc(teacherProfilesCol, {
    name, subject: subject || '—', bio: bio || '', email: email || '', phone: phone || '',
    initial: (name || 'م').trim().charAt(0),
  });
  return ref.id;
}

export async function updateTeacherProfile(id, patch) {
  await updateDoc(doc(db, 'teacherProfiles', id), patch);
}
