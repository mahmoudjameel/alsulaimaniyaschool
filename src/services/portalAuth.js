import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';

/**
 * Ask the backend for a Firebase custom token so parent/student can sign in
 * without a password (phone or study ID only).
 */
export async function issuePortalToken({ role, identifier }) {
  const fn = httpsCallable(functions, 'issuePortalToken');
  const { data } = await fn({ role, identifier });
  return data;
}
