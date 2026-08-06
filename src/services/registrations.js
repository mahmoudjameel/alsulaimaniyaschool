import { addDoc, serverTimestamp } from 'firebase/firestore';
import { composeFullName, formatGradeLabel } from '../lib/constants';
import { resolveAcademicYear } from '../lib/liveAcademicYear';
import { admissionsCol } from './admissions';

/**
 * Public admissions-request form on the marketing site. Anyone can create
 * (see firestore.rules — create-only, no read/list), and it lands directly
 * in the same `admissions` collection the admin portal reviews.
 */
export async function submitRegistration(form) {
  const {
    guardianName, phone, phoneDial, phoneLocal, phoneE164, phoneWa,
    residentialAddress, guardianWorkStatus, housingType,
    nameFirst, nameFather, nameGrandfather, nameFamily,
    studentName, nationalId, stageId, stageLabel, classSection, ageYears, birthDate,
    academicYear, contactMethod, notes,
  } = form;

  const name = composeFullName({ nameFirst, nameFather, nameGrandfather, nameFamily })
    || (studentName || '').trim();
  const stage = stageLabel || form.grade || '';
  const year = await resolveAcademicYear(academicYear);
  const grade = formatGradeLabel(stage, classSection) || stage;

  await addDoc(admissionsCol, {
    name,
    nameFirst: (nameFirst || '').trim() || null,
    nameFather: (nameFather || '').trim() || null,
    nameGrandfather: (nameGrandfather || '').trim() || null,
    nameFamily: (nameFamily || '').trim() || null,
    nationalId: (nationalId || '').trim() || null,
    guardian: guardianName,
    phone: phoneE164 || phone,
    phoneDial: phoneDial || null,
    phoneLocal: phoneLocal || null,
    phoneE164: phoneE164 || phone || null,
    phoneWa: phoneWa || null,
    residentialAddress: (residentialAddress || '').trim() || null,
    guardianWorkStatus: (guardianWorkStatus || '').trim() || null,
    housingType: (housingType || '').trim() || null,
    stageId: stageId || null,
    stageLabel: stage,
    classSection: classSection || null,
    birthDate: (birthDate || '').trim() || null,
    ageYears: ageYears != null && ageYears !== '' ? Number(ageYears) : null,
    academicYear: year,
    grade,
    contactMethod,
    notes: notes || '',
    source: 'الموقع',
    status: 'review',
    createdAt: serverTimestamp(),
  });
}
