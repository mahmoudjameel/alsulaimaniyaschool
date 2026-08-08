import { collection, doc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase/config';
import { shekelsToMinorUnits } from '../lib/constants';

export const usersCol = collection(db, 'users');

/**
 * Provisions Firebase Auth + users/{uid} (+ staff payroll row for teacher/accountant/reception).
 * Allowed with users.manage or staff.manage (portal roles only for staff.manage).
 */
export async function createStaffAccount({
  email, name, role, title, childStudentIds, password,
  salaryType, monthlySalaryShekels, hourlyRateShekels, dailyRateShekels,
  hoursPerMonth, phone, notes,
}) {
  const fn = httpsCallable(functions, 'createStaffAccount');
  const payload = { email, name, role, title, childStudentIds, password };
  if (salaryType) {
    payload.salaryType = salaryType;
    payload.monthlySalaryMinorUnits = salaryType === 'monthly' ? shekelsToMinorUnits(monthlySalaryShekels) : null;
    payload.hourlyRateMinorUnits = salaryType === 'hourly' ? shekelsToMinorUnits(hourlyRateShekels) : null;
    payload.dailyRateMinorUnits = salaryType === 'daily' ? shekelsToMinorUnits(dailyRateShekels) : null;
    payload.hoursPerMonth = salaryType === 'hourly' ? Number(hoursPerMonth) || 160 : null;
  }
  if (phone != null) payload.phone = phone;
  if (notes != null) payload.notes = notes;
  return fn(payload);
}

/** Update profile + Auth (name/title/email/password/role/permissions). Requires users.manage. */
export async function updateStaffAccount({ uid, name, title, email, password, role, permissions }) {
  const fn = httpsCallable(functions, 'updateStaffAccount');
  return fn({ uid, name, title, email, password, role, permissions });
}

/** Delete Auth + users doc (deactivates linked payroll row). Requires users.manage. */
export async function deleteStaffAccount(uid) {
  const fn = httpsCallable(functions, 'deleteStaffAccount');
  return fn({ uid });
}

/** Client-side permissions/role patch (legacy). Prefer updateStaffAccount for full edits. */
export async function updateUserAccess(uid, { role, permissions }) {
  const patch = {};
  if (role) patch.role = role;
  if (permissions) patch.permissions = permissions;
  await updateDoc(doc(db, 'users', uid), patch);
}
