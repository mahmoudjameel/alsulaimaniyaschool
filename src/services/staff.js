import {
  addDoc, collection, deleteDoc, doc, serverTimestamp, setDoc, updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { shekelsToMinorUnits } from '../lib/constants';

export const staffCol = collection(db, 'staff');

export async function createStaffMember(payload) {
  const {
    name, roleType, jobTitleAr, salaryType,
    monthlySalaryShekels, hourlyRateShekels, dailyRateShekels, hoursPerMonth,
    phone, notes, authUid,
  } = payload;

  const monthlySalaryMinorUnits = salaryType === 'monthly' ? shekelsToMinorUnits(monthlySalaryShekels) : null;
  const hourlyRateMinorUnits = salaryType === 'hourly' ? shekelsToMinorUnits(hourlyRateShekels) : null;
  const dailyRateMinorUnits = salaryType === 'daily' ? shekelsToMinorUnits(dailyRateShekels) : null;
  const baseMinorUnits = monthlySalaryMinorUnits || hourlyRateMinorUnits || dailyRateMinorUnits || 0;
  const legacyType = salaryType === 'hourly' ? 'أجر ساعة' : salaryType === 'daily' ? 'راتب يومي' : 'راتب شهري';

  const ref = await addDoc(staffCol, {
    name: (name || '').trim(),
    roleType: roleType || 'other',
    jobTitleAr: (jobTitleAr || '').trim() || 'موظف',
    role: (jobTitleAr || '').trim() || 'موظف',
    salaryType: salaryType || 'monthly',
    type: legacyType,
    monthlySalaryMinorUnits,
    hourlyRateMinorUnits,
    dailyRateMinorUnits,
    hoursPerMonth: salaryType === 'hourly' ? Number(hoursPerMonth) || 160 : null,
    baseMinorUnits,
    phone: (phone || '').trim() || null,
    notes: (notes || '').trim() || null,
    authUid: authUid || null,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateStaffMember(staffId, payload) {
  const {
    name, roleType, jobTitleAr, salaryType,
    monthlySalaryShekels, hourlyRateShekels, dailyRateShekels, hoursPerMonth,
    phone, notes, active,
  } = payload;

  const monthlySalaryMinorUnits = salaryType === 'monthly' ? shekelsToMinorUnits(monthlySalaryShekels) : null;
  const hourlyRateMinorUnits = salaryType === 'hourly' ? shekelsToMinorUnits(hourlyRateShekels) : null;
  const dailyRateMinorUnits = salaryType === 'daily' ? shekelsToMinorUnits(dailyRateShekels) : null;
  const baseMinorUnits = monthlySalaryMinorUnits || hourlyRateMinorUnits || dailyRateMinorUnits || 0;
  const legacyType = salaryType === 'hourly' ? 'أجر ساعة' : salaryType === 'daily' ? 'راتب يومي' : 'راتب شهري';

  await updateDoc(doc(db, 'staff', staffId), {
    name: (name || '').trim(),
    roleType: roleType || 'other',
    jobTitleAr: (jobTitleAr || '').trim() || 'موظف',
    role: (jobTitleAr || '').trim() || 'موظف',
    salaryType: salaryType || 'monthly',
    type: legacyType,
    monthlySalaryMinorUnits,
    hourlyRateMinorUnits,
    dailyRateMinorUnits,
    hoursPerMonth: salaryType === 'hourly' ? Number(hoursPerMonth) || 160 : null,
    baseMinorUnits,
    phone: (phone || '').trim() || null,
    notes: (notes || '').trim() || null,
    active: active !== false,
    updatedAt: serverTimestamp(),
  });
}

export async function setStaffAttendance(staffId, period, { daysPresent, workingDays, hoursWorked }) {
  await setDoc(doc(db, 'staff', staffId, 'attendance', period), {
    daysPresent: Number(daysPresent) || 0,
    workingDays: Number(workingDays) || 22,
    hoursWorked: hoursWorked != null && hoursWorked !== '' ? Number(hoursWorked) : null,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function deleteStaffMember(staffId) {
  await deleteDoc(doc(db, 'staff', staffId));
}
