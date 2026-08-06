import {
  addDoc, collection, doc, getDocs, orderBy, query, serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  composeFullName, formatGradeLabel, GRADE_OPTIONS,
} from '../lib/constants';
import { resolveAcademicYear } from '../lib/liveAcademicYear';
import { phoneKeyFromLocal } from '../lib/phone';

export const studentsCol = collection(db, 'students');

/**
 * Creates a student with the full registration payload used by admin
 * onboarding (4-part name, national ID, stage, section, age, year).
 */
export async function createStudent(payload = {}) {
  const {
    nameFirst, nameFather, nameGrandfather, nameFamily,
    name: nameOverride, guardianName, guardianPhone,
    guardianPhoneDial, guardianPhoneLocal, guardianPhoneE164, guardianPhoneWa,
    guardianPhoneKey,
    residentialAddress, guardianWorkStatus, housingType,
    nationalId, academicYear, stageId, stageLabel, classSection,
    ageYears, birthDate, grade, shift,
  } = payload;

  const name = (nameOverride || composeFullName({
    nameFirst, nameFather, nameGrandfather, nameFamily,
  })).trim() || 'طالب جديد';
  const stage = stageLabel || grade || GRADE_OPTIONS[2];
  const gradeLabel = formatGradeLabel(stage, classSection) || stage;
  const initial = name.charAt(0);
  const phoneLocal = guardianPhoneLocal || null;
  const phoneKey = guardianPhoneKey || phoneKeyFromLocal(phoneLocal) || null;

  const snap = await getDocs(query(collection(db, 'students')));
  const nextNumber = 1200 + snap.size + Math.floor(Math.random() * 90);

  const year = await resolveAcademicYear(academicYear);

  const docRef = await addDoc(studentsCol, {
    name,
    nameFirst: (nameFirst || '').trim() || null,
    nameFather: (nameFather || '').trim() || null,
    nameGrandfather: (nameGrandfather || '').trim() || null,
    nameFamily: (nameFamily || '').trim() || null,
    nationalId: (nationalId || '').trim() || null,
    academicYear: year,
    stageId: stageId || null,
    stageLabel: stage,
    classSection: classSection || null,
    birthDate: (birthDate || '').trim() || null,
    ageYears: ageYears != null && ageYears !== '' ? Number(ageYears) : null,
    displayId: `STU-${nextNumber}`,
    guardianName: guardianName || '—',
    guardianPhone: guardianPhoneE164 || guardianPhone || null,
    guardianPhoneDial: guardianPhoneDial || null,
    guardianPhoneLocal: phoneLocal,
    guardianPhoneE164: guardianPhoneE164 || guardianPhone || null,
    guardianPhoneWa: guardianPhoneWa || null,
    guardianPhoneKey: phoneKey,
    residentialAddress: (residentialAddress || '').trim() || null,
    guardianWorkStatus: (guardianWorkStatus || '').trim() || null,
    housingType: (housingType || '').trim() || null,
    // Portal UIDs are linked on first parent/student login (or admissions accept)
    studentUid: null,
    guardianUid: null,
    grade: gradeLabel,
    shift: shift || 'صباحي',
    status: 'نشط',
    balanceMinorUnits: 0,
    initial,
    createdAt: serverTimestamp(),
  });

  // Mirror primary guardian into subcollection (StudentProfile / future multi-guardian)
  await addDoc(collection(db, 'students', docRef.id, 'guardians'), {
    name: guardianName || '—',
    phone: guardianPhoneE164 || guardianPhone || null,
    phoneLocal,
    phoneKey,
    residentialAddress: (residentialAddress || '').trim() || null,
    workStatus: (guardianWorkStatus || '').trim() || null,
    housingType: (housingType || '').trim() || null,
    relation: 'ولي أمر',
    primary: true,
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}

export async function updateStudent(studentId, patch) {
  await updateDoc(doc(db, 'students', studentId), patch);

  // Keep primary guardian mirror in sync when contact / household fields change
  const touchesGuardian = [
    'guardianName', 'guardianPhone', 'guardianPhoneE164', 'guardianPhoneLocal', 'guardianPhoneKey',
    'residentialAddress', 'guardianWorkStatus', 'housingType',
  ].some((k) => Object.prototype.hasOwnProperty.call(patch, k));
  if (touchesGuardian) {
    const gSnap = await getDocs(collection(db, 'students', studentId, 'guardians'));
    const primary = gSnap.docs.find((d) => d.data().primary) || gSnap.docs[0];
    const guardianPatch = {
      relation: 'ولي أمر',
      primary: true,
      updatedAt: serverTimestamp(),
    };
    if (Object.prototype.hasOwnProperty.call(patch, 'guardianName')) {
      guardianPatch.name = patch.guardianName || '—';
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'guardianPhoneE164')
      || Object.prototype.hasOwnProperty.call(patch, 'guardianPhone')) {
      guardianPatch.phone = patch.guardianPhoneE164 || patch.guardianPhone || null;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'guardianPhoneLocal')) {
      guardianPatch.phoneLocal = patch.guardianPhoneLocal || null;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'guardianPhoneKey')) {
      guardianPatch.phoneKey = patch.guardianPhoneKey || null;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'residentialAddress')) {
      guardianPatch.residentialAddress = patch.residentialAddress || null;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'guardianWorkStatus')) {
      guardianPatch.workStatus = patch.guardianWorkStatus || null;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'housingType')) {
      guardianPatch.housingType = patch.housingType || null;
    }
    if (primary) {
      await updateDoc(primary.ref, guardianPatch);
    } else {
      await addDoc(collection(db, 'students', studentId, 'guardians'), {
        name: guardianPatch.name || '—',
        phone: guardianPatch.phone || null,
        phoneLocal: guardianPatch.phoneLocal || null,
        phoneKey: guardianPatch.phoneKey || null,
        residentialAddress: guardianPatch.residentialAddress || null,
        workStatus: guardianPatch.workStatus || null,
        housingType: guardianPatch.housingType || null,
        relation: 'ولي أمر',
        primary: true,
        createdAt: serverTimestamp(),
      });
    }
  }
}

/** Minimal CSV importer: supports both legacy and extended headers. */
export async function bulkCreateStudents(rows) {
  const results = [];
  for (const row of rows) {
    // eslint-disable-next-line no-await-in-loop
    const id = await createStudent(row);
    results.push(id);
  }
  return results;
}

export function parseStudentsCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((c) => c.trim());
    const get = (...keys) => {
      for (const key of keys) {
        const idx = header.indexOf(key);
        if (idx >= 0) return cells[idx];
      }
      return '';
    };
    const nameFirst = get('namefirst', 'الاسم الأول');
    const nameFather = get('namefather', 'اسم الأب');
    const nameGrandfather = get('namegrandfather', 'اسم الجد');
    const nameFamily = get('namefamily', 'العائلة');
    const legacyName = get('name', 'الاسم');
    return {
      nameFirst, nameFather, nameGrandfather, nameFamily,
      name: legacyName || undefined,
      guardianName: get('guardianname', 'ولي الأمر'),
      guardianPhone: get('guardianphone', 'هاتف ولي الأمر'),
      residentialAddress: get('residentialaddress', 'عنوان السكن', 'العنوان'),
      guardianWorkStatus: get('guardianworkstatus', 'حالة العمل', 'العمل'),
      housingType: get('housingtype', 'نوع السكن'),
      nationalId: get('nationalid', 'رقم الهوية'),
      grade: get('grade', 'الصف', 'المرحلة'),
      stageLabel: get('stage', 'المرحلة'),
      classSection: get('section', 'الشعبة'),
      ageYears: get('age', 'العمر'),
      birthDate: get('birthdate', 'dateofbirth', 'تاريخ الميلاد'),
      academicYear: get('academicyear', 'السنة الدراسية'),
      shift: get('shift', 'الفترة'),
    };
  }).filter((r) => r.name || r.nameFirst);
}

export function studentSubcollection(studentId, name) {
  return collection(db, 'students', studentId, name);
}

export async function addLedgerEntry(studentId, entry) {
  await addDoc(studentSubcollection(studentId, 'ledger'), {
    ...entry,
    createdAt: serverTimestamp(),
  });
}

export async function addStudentNote(studentId, note) {
  await addDoc(studentSubcollection(studentId, 'notes'), {
    ...note,
    createdAt: serverTimestamp(),
  });
}

export const ledgerQuery = (studentId) => query(studentSubcollection(studentId, 'ledger'), orderBy('date', 'asc'));
export const documentsQuery = (studentId) => query(studentSubcollection(studentId, 'documents'), orderBy('date', 'desc'));
export const attendanceQuery = (studentId) => query(studentSubcollection(studentId, 'attendanceRecords'), orderBy('date', 'desc'));
export const notesQuery = (studentId) => query(studentSubcollection(studentId, 'notes'), orderBy('createdAt', 'desc'));
export const guardiansQuery = (studentId) => query(studentSubcollection(studentId, 'guardians'), orderBy('createdAt', 'asc'));
export const studentClassesQuery = (studentId) => query(studentSubcollection(studentId, 'classes'), orderBy('createdAt', 'asc'));
