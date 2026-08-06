import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { CURRENT_ACADEMIC_YEAR } from './constants';

/**
 * Live academic year from schoolSettings/main (no dependency on student/rollover services).
 */
export async function resolveAcademicYear(explicit) {
  if (explicit != null && String(explicit).trim()) return String(explicit).trim();
  try {
    const snap = await getDoc(doc(db, 'schoolSettings', 'main'));
    const y = snap.exists() ? snap.data()?.academicYear : null;
    if (y != null && String(y).trim()) return String(y).trim();
  } catch {
    /* fall through */
  }
  return CURRENT_ACADEMIC_YEAR;
}
