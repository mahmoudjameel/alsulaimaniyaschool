import { collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase/config';

export const admissionsCol = collection(db, 'admissions');

/** Marks an application accepted and asks the backend to provision the
 * student record + parent/student Firebase Auth accounts atomically. */
export async function acceptAdmission(admissionId) {
  const fn = httpsCallable(functions, 'acceptAdmission');
  return fn({ admissionId });
}

export async function rejectAdmission(admissionId) {
  await updateDoc(doc(db, 'admissions', admissionId), {
    status: 'rejected',
    decidedAt: serverTimestamp(),
  });
}
