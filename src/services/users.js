import { collection, doc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase/config';

export const usersCol = collection(db, 'users');

/** Admin-only: provisions a real Firebase Auth account + Firestore user
 * doc for a new staff member (teacher/accountant/admin) or a parent. */
export async function createStaffAccount({ email, name, role, title, childStudentIds }) {
  const fn = httpsCallable(functions, 'createStaffAccount');
  return fn({ email, name, role, title, childStudentIds });
}

/** Admin-only: change a staff member's role and/or their granted permissions. */
export async function updateUserAccess(uid, { role, permissions }) {
  const patch = {};
  if (role) patch.role = role;
  if (permissions) patch.permissions = permissions;
  await updateDoc(doc(db, 'users', uid), patch);
}
