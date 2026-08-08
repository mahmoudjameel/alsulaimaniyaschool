import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';

initializeApp();
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

const db = getFirestore();
const auth = getAuth();

const STUDENT_AUTH_EMAIL_DOMAIN = 'students.sulaimaniya.local';
const PARENT_AUTH_EMAIL_DOMAIN = 'parents.sulaimaniya.local';
const studentIdToAuthEmail = (studentId) =>
  `${studentId.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')}@${STUDENT_AUTH_EMAIL_DOMAIN}`;
const parentPhoneToAuthEmail = (phoneKey) => `p-${phoneKey}@${PARENT_AUTH_EMAIL_DOMAIN}`;

const randomTempPassword = () => `Sc-${Math.random().toString(36).slice(2, 8)}${Math.floor(Math.random() * 90 + 10)}`;

/** Digits-only helper for portal phone matching. */
function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

/** Normalize to local 05XXXXXXXX (Palestinian mobile). */
function normalizeLocalMobile(raw) {
  let d = digitsOnly(raw);
  if (d.startsWith('970') && d.length >= 12) d = d.slice(3);
  if (d.startsWith('972') && d.length >= 12) d = d.slice(3);
  if (d.length === 9 && d.startsWith('5')) d = `0${d}`;
  return d;
}

function isValidLocalMobile(raw) {
  return /^05\d{8}$/.test(normalizeLocalMobile(raw));
}

/** Stable key shared by +970 / +972 for the same handset: 592799888 */
function phoneKeyFromAny(raw) {
  const local = normalizeLocalMobile(raw);
  if (!/^05\d{8}$/.test(local)) return null;
  return local.slice(1); // drop leading 0
}

function phoneVariantsForKey(phoneKey) {
  const local = `0${phoneKey}`;
  return {
    local,
    phoneKey,
    e164_970: `+970${phoneKey}`,
    e164_972: `+972${phoneKey}`,
    wa_970: `970${phoneKey}`,
    wa_972: `972${phoneKey}`,
    plain_970: `970${phoneKey}`,
    plain_972: `972${phoneKey}`,
  };
}

async function findStudentsByPhoneKey(phoneKey) {
  const v = phoneVariantsForKey(phoneKey);
  const fields = [
    ['guardianPhoneLocal', v.local],
    ['guardianPhoneE164', v.e164_970],
    ['guardianPhoneE164', v.e164_972],
    ['guardianPhoneWa', v.wa_970],
    ['guardianPhoneWa', v.wa_972],
    ['guardianPhone', v.local],
    ['guardianPhone', v.e164_970],
    ['guardianPhone', v.e164_972],
    ['guardianPhone', v.wa_970],
    ['guardianPhoneKey', phoneKey],
    ['phone', v.local],
  ];
  const byId = new Map();
  await Promise.all(fields.map(async ([field, value]) => {
    const snap = await db.collection('students').where(field, '==', value).limit(25).get();
    snap.forEach((docSnap) => byId.set(docSnap.id, { id: docSnap.id, ...docSnap.data() }));
  }));
  return [...byId.values()];
}

async function ensureStudentAuthUser(student) {
  if (student.studentUid) {
    try {
      await auth.getUser(student.studentUid);
      return student.studentUid;
    } catch {
      // fall through and recreate
    }
  }
  const displayId = student.displayId;
  if (!displayId) throw new HttpsError('failed-precondition', 'الطالب بلا رقم دراسي.');
  const email = studentIdToAuthEmail(displayId);
  let uid;
  try {
    const existing = await auth.getUserByEmail(email);
    uid = existing.uid;
  } catch {
    const created = await auth.createUser({
      email,
      password: randomTempPassword(),
      displayName: student.name || displayId,
    });
    uid = created.uid;
  }
  await db.collection('students').doc(student.id).set({ studentUid: uid }, { merge: true });
  await db.collection('users').doc(uid).set({
    role: 'student',
    name: student.name || displayId,
    displayId,
    studentId: student.id,
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return uid;
}

async function ensureParentAuthUser({ phoneKey, name, students }) {
  const v = phoneVariantsForKey(phoneKey);
  // Prefer an already-linked guardian on any matching child.
  for (const s of students) {
    if (s.guardianUid) {
      try {
        await auth.getUser(s.guardianUid);
        await db.collection('users').doc(s.guardianUid).set({
          role: 'parent',
          phoneKey,
          phoneLocal: v.local,
          phoneE164: v.e164_970,
        }, { merge: true });
        return s.guardianUid;
      } catch {
        // stale uid — continue
      }
    }
  }

  const byKey = await db.collection('users').where('phoneKey', '==', phoneKey).limit(10).get();
  const existingParent = byKey.docs.find((d) => d.data().role === 'parent');
  if (existingParent) return existingParent.id;

  const email = parentPhoneToAuthEmail(phoneKey);
  let uid;
  try {
    uid = (await auth.getUserByEmail(email)).uid;
  } catch {
    const created = await auth.createUser({
      email,
      password: randomTempPassword(),
      displayName: name || `ولي أمر ${v.local}`,
    });
    uid = created.uid;
  }

  await db.collection('users').doc(uid).set({
    role: 'parent',
    name: name || students[0]?.guardianName || `ولي أمر ${v.local}`,
    title: 'ولي أمر',
    phoneKey,
    phoneLocal: v.local,
    phoneE164: v.e164_970,
    phoneDial: '970',
    permissions: {},
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return uid;
}

async function linkStudentsToParent(students, parentUid, phoneKey) {
  const v = phoneVariantsForKey(phoneKey);
  const batch = db.batch();
  for (const s of students) {
    batch.set(db.collection('students').doc(s.id), {
      guardianUid: parentUid,
      guardianPhoneKey: phoneKey,
      guardianPhoneLocal: s.guardianPhoneLocal || v.local,
      guardianPhoneE164: s.guardianPhoneE164 || v.e164_970,
      guardianPhoneWa: s.guardianPhoneWa || v.wa_970,
      guardianPhoneDial: s.guardianPhoneDial || '970',
    }, { merge: true });
  }
  await batch.commit();
}

// Kept in sync by hand with src/lib/permissions.js (browser bundle can't be
// imported here). Source of truth for starting defaults; UI can override.
// effectivePermission merges these defaults with stored user.permissions.
const ROLE_DEFAULT_PERMISSIONS = {
  admin: {
    'admissions.manage': true, 'students.manage': true, 'stages.manage': true, 'enrollment.manage': true,
    'billing.manage': true, 'payments.manage': true, 'payroll.manage': true, 'staff.manage': true,
    'disbursements.manage': true, 'expenses.manage': true, 'classes.manage': true, 'teachers.manage': true,
    'grades.approve': true, 'cms.manage': true, 'users.manage': true, 'system.backup': true, 'activity.view': true,
  },
  director: {
    'admissions.manage': true, 'students.manage': true, 'stages.manage': true, 'enrollment.manage': true,
    'classes.manage': true, 'teachers.manage': true, 'grades.approve': true, 'cms.manage': true, 'activity.view': true,
  },
  accountant: {
    'billing.manage': true, 'payments.manage': true, 'expenses.manage': true, 'enrollment.manage': true,
    'students.manage': true, 'payroll.manage': true, 'disbursements.manage': true, 'staff.manage': true,
  },
  teacher: { 'classes.manage': true },
  reception: {
    'admissions.manage': true, 'students.manage': true, 'enrollment.manage': true,
  },
  parent: {},
};

/**
 * Two-layer authorization, mirrored from firestore.rules + src/lib/permissions.js:
 * `role === 'admin'` always passes; otherwise merge role defaults with the
 * stored `users/{uid}.permissions` map (stored false revokes a default).
 */
function effectivePermission(user, key) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const defaults = ROLE_DEFAULT_PERMISSIONS[user.role] || {};
  const stored = user.permissions || {};
  if (Object.prototype.hasOwnProperty.call(stored, key)) return !!stored[key];
  return !!defaults[key];
}

async function requirePermission(request, key) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول.');
  const user = (await db.collection('users').doc(uid).get()).data();
  const keys = Array.isArray(key) ? key : [key];
  if (!keys.some((k) => effectivePermission(user, k))) {
    throw new HttpsError('permission-denied', 'لا تملك صلاحية هذا الإجراء.');
  }
  return { uid, user };
}

/** Same audit trail the client writes to via src/services/activity.js —
 * kept so server-driven actions (account creation, admissions) show up in
 * the admin's "سجلّ الحركات" screen too, not just client-initiated writes. */
async function logActivity({ type, actorUid, actorName, actorRole, summary, targetType, targetId }) {
  await db.collection('activityLog').add({
    type, actorUid, actorName: actorName || '—', actorRole: actorRole || '—', summary,
    targetType: targetType || null, targetId: targetId || null, createdAt: FieldValue.serverTimestamp(),
  });
}

/** Place accepted/registered students into classrooms matching مرحلة + شعبة + دوام. */
const SECTION_LETTERS = ['أ', 'ب', 'ج', 'د'];

function parseStageAndSection(label) {
  const raw = String(label || '').trim();
  if (!raw) return { stage: '', section: null };
  const m = raw.match(/^(.*?)\s*\/\s*([أبجد])\s*$/u);
  if (m) return { stage: m[1].trim(), section: m[2] };
  return { stage: raw, section: null };
}

function resolveClassSection(cls) {
  if (cls?.classSection && SECTION_LETTERS.includes(cls.classSection)) return cls.classSection;
  const fromGrade = parseStageAndSection(cls?.grade).section;
  if (fromGrade) return fromGrade;
  const title = String(cls?.title || '');
  const m = title.match(/(?:^|[\s\/·\-])([أبجد])\s*$/u)
    || title.match(/شعبة\s*([أبجد])/u);
  return m && SECTION_LETTERS.includes(m[1]) ? m[1] : null;
}

function classMatchesStudent(cls, student) {
  const studentStage = String(student.stageLabel || parseStageAndSection(student.grade).stage || '').trim();
  const classStage = String(parseStageAndSection(cls.grade).stage || cls.grade || '').trim();
  if (!studentStage || !classStage) return false;
  if (classStage !== studentStage && String(cls.grade || '').trim() !== String(student.grade || '').trim()) {
    return false;
  }
  if (student.shift && cls.shift && student.shift !== cls.shift) return false;
  const studentSection = student.classSection || parseStageAndSection(student.grade).section;
  const classSection = resolveClassSection(cls);
  if (classSection && studentSection && classSection !== studentSection) return false;
  if (classSection && !studentSection) return false;
  return true;
}

async function enrollStudentAdmin(classId, classInfo, student) {
  const enrollmentRef = db.collection('classes').doc(classId).collection('enrollments').doc(student.id);
  const existing = await enrollmentRef.get();
  if (existing.exists) return false;
  await enrollmentRef.set({
    studentId: student.id,
    studentName: student.name,
    displayId: student.displayId || null,
    grade: student.grade || null,
    enrolledAt: FieldValue.serverTimestamp(),
  });
  await db.collection('students').doc(student.id).collection('classes').doc(classId).set({
    subject: classInfo.subject || '',
    subjects: classInfo.subjects || null,
    title: classInfo.title || '',
    teacher: classInfo.teacher || '',
    teacherId: classInfo.teacherId || null,
    teacherIds: classInfo.teacherIds || (classInfo.teacherId ? [classInfo.teacherId] : []),
    shift: classInfo.shift || null,
    grade: classInfo.grade || student.grade || '—',
    schedule: Array.isArray(classInfo.schedule) ? classInfo.schedule : [],
    createdAt: FieldValue.serverTimestamp(),
  });
  await db.collection('classes').doc(classId).update({
    studentsCount: FieldValue.increment(1),
  });
  return true;
}

async function enrollStudentInMatchingClassesAdmin(student) {
  const snap = await db.collection('classes').get();
  let enrolled = 0;
  let matched = 0;
  const classes = [];
  for (const d of snap.docs) {
    const cls = { id: d.id, ...d.data() };
    if (!classMatchesStudent(cls, student)) continue;
    matched += 1;
    classes.push({ id: cls.id, title: cls.title, subject: cls.subject });
    if (await enrollStudentAdmin(cls.id, cls, student)) enrolled += 1;
  }
  return { enrolled, matched, classes };
}

/** Academic year tuition: Sep→Jun (10 months). */
const TUITION_MONTH_ORDER = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
const MONTH_LABELS_AR = {
  1: 'كانون الثاني', 2: 'شباط', 3: 'آذار', 4: 'نيسان', 5: 'أيار', 6: 'حزيران',
  9: 'أيلول', 10: 'تشرين الأول', 11: 'تشرين الثاني', 12: 'كانون الأول',
};

function academicYearStartYear(academicYear) {
  const m = String(academicYear || '').match(/(\d{4})/);
  if (m) return Number(m[1]);
  const now = new Date();
  return now.getMonth() + 1 >= 9 ? now.getFullYear() : now.getFullYear() - 1;
}

function academicTuitionPeriods(academicYear) {
  const startYear = academicYearStartYear(academicYear);
  return TUITION_MONTH_ORDER.map((month) => {
    const year = month >= 9 ? startYear : startYear + 1;
    return {
      period: `${year}-${String(month).padStart(2, '0')}`,
      labelAr: `${MONTH_LABELS_AR[month] || month} ${year}`,
    };
  });
}

async function createAcademicYearTuitionPlanAdmin({
  studentId, studentName, stageId, stageLabel, classSection, grade, academicYear, monthlyTuitionMinorUnits,
}) {
  const monthly = Number(monthlyTuitionMinorUnits) || 0;
  if (!studentId || monthly <= 0) return { created: 0, monthly };
  const periods = academicTuitionPeriods(academicYear);
  const today = new Date().toISOString().slice(0, 10);
  let created = 0;
  for (const { period, labelAr } of periods) {
    const chargeId = `${studentId}_${period}_tuition`;
    const chargeRef = db.collection('charges').doc(chargeId);
    // eslint-disable-next-line no-await-in-loop
    const existing = await chargeRef.get();
    if (existing.exists) continue;
    // eslint-disable-next-line no-await-in-loop
    await db.runTransaction(async (tx) => {
      const again = await tx.get(chargeRef);
      if (again.exists) return;
      tx.set(chargeRef, {
        studentId,
        student: studentName || '—',
        period,
        periodLabel: labelAr,
        type: 'رسوم دراسية شهرية',
        amountMinorUnits: monthly,
        discountMinorUnits: 0,
        status: 'مسودّة',
        method: '—',
        stageId: stageId || null,
        stageLabel: stageLabel || null,
        classSection: classSection || null,
        grade: grade || stageLabel || null,
        academicYear: academicYear || null,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.set(db.collection('students').doc(studentId).collection('ledger').doc(), {
        date: today,
        item: `رسوم دراسية — ${labelAr}`,
        debitMinorUnits: monthly,
        creditMinorUnits: 0,
        chargeId,
        period,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.update(db.collection('students').doc(studentId), {
        balanceMinorUnits: FieldValue.increment(monthly),
      });
    });
    created += 1;
  }
  return { created, monthly, months: periods.length };
}

// ─────────────────────────────────────────────────────────────────────────
// Admissions → Students
// ─────────────────────────────────────────────────────────────────────────

export const acceptAdmission = onCall(async (request) => {
  const { uid: actorUid, user: actor } = await requirePermission(request, 'admissions.manage');
  const { admissionId } = request.data || {};
  if (!admissionId) throw new HttpsError('invalid-argument', 'admissionId مطلوب.');

  const admissionRef = db.collection('admissions').doc(admissionId);
  const admissionSnap = await admissionRef.get();
  if (!admissionSnap.exists) throw new HttpsError('not-found', 'طلب التسجيل غير موجود.');
  const admission = admissionSnap.data();
  if (admission.status && admission.status !== 'review') {
    throw new HttpsError('failed-precondition', 'تم البتّ في هذا الطلب مسبقاً.');
  }

  // Sequential, human-friendly display IDs (STU-1200, STU-1201, …).
  const countSnap = await db.collection('students').count().get();
  const displayId = `STU-${1200 + countSnap.data().count}`;
  const tempPassword = randomTempPassword();
  const phoneKey = phoneKeyFromAny(admission.phoneE164 || admission.phoneLocal || admission.phone || '');

  const authUser = await auth.createUser({
    email: studentIdToAuthEmail(displayId),
    password: tempPassword,
    displayName: admission.name,
  });

  // Auto-link / create parent account from guardian phone so they can
  // sign in later with the phone only (no password).
  let guardianUid = null;
  if (phoneKey) {
    guardianUid = await ensureParentAuthUser({
      phoneKey,
      name: admission.guardian || null,
      students: [],
    });
  }

  const studentRef = db.collection('students').doc();

  // Resolve seat reservation + monthly tuition from the admission's academic stage.
  let seatFee = 0;
  let monthlyTuition = 0;
  const stageId = admission.stageId || null;
  const stageLabelForSeat = admission.stageLabel || admission.grade || null;
  let stageData = null;
  if (stageId) {
    const stageSnap = await db.collection('academicStages').doc(stageId).get();
    if (stageSnap.exists) {
      stageData = stageSnap.data();
      seatFee = Number(stageData?.seatReservationMinorUnits) || 0;
      monthlyTuition = Number(stageData?.monthlyTuitionMinorUnits) || 0;
    }
  }
  if (!monthlyTuition && stageLabelForSeat) {
    const byLabel = await db.collection('academicStages').where('labelAr', '==', stageLabelForSeat).limit(1).get();
    if (!byLabel.empty) {
      monthlyTuition = Number(byLabel.docs[0].data()?.monthlyTuitionMinorUnits) || 0;
      if (!seatFee) seatFee = Number(byLabel.docs[0].data()?.seatReservationMinorUnits) || 0;
    }
  }

  const batch = db.batch();
  batch.set(studentRef, {
    name: admission.name,
    nameFirst: admission.nameFirst || null,
    nameFather: admission.nameFather || null,
    nameGrandfather: admission.nameGrandfather || null,
    nameFamily: admission.nameFamily || null,
    nationalId: admission.nationalId || null,
    academicYear: admission.academicYear || null,
    stageId: admission.stageId || null,
    stageLabel: admission.stageLabel || admission.grade || 'الأول الأساسي',
    classSection: admission.classSection || null,
    birthDate: admission.birthDate || null,
    ageYears: admission.ageYears != null ? admission.ageYears : null,
    displayId,
    guardianName: admission.guardian || '—',
    guardianPhone: admission.phoneE164 || admission.phone || null,
    guardianPhoneDial: admission.phoneDial || null,
    guardianPhoneLocal: admission.phoneLocal || (phoneKey ? `0${phoneKey}` : null),
    guardianPhoneE164: admission.phoneE164 || admission.phone || null,
    guardianPhoneWa: admission.phoneWa || null,
    guardianPhoneKey: phoneKey,
    residentialAddress: admission.residentialAddress || null,
    guardianWorkStatus: admission.guardianWorkStatus || null,
    housingType: admission.housingType || null,
    guardianUid,
    grade: admission.grade || admission.stageLabel || 'الأول الأساسي',
    shift: 'صباحي',
    status: 'نشط',
    balanceMinorUnits: seatFee > 0 ? seatFee : 0,
    initial: (admission.name || 'ط').trim().charAt(0),
    studentUid: authUser.uid,
    createdAt: FieldValue.serverTimestamp(),
  });
  batch.set(db.collection('users').doc(authUser.uid), {
    role: 'student', name: admission.name, displayId, studentId: studentRef.id,
    createdAt: FieldValue.serverTimestamp(),
  });
  batch.update(admissionRef, {
    status: 'accepted', decidedAt: FieldValue.serverTimestamp(), linkedStudentId: studentRef.id,
  });

  if (seatFee > 0) {
    const chargeId = `${studentRef.id}_seat_reservation`;
    batch.set(db.collection('charges').doc(chargeId), {
      studentId: studentRef.id,
      student: admission.name,
      type: 'حجز مقعد',
      amountMinorUnits: seatFee,
      discountMinorUnits: 0,
      status: 'مسودّة',
      method: '—',
      stageId,
      stageLabel: stageLabelForSeat,
      classSection: admission.classSection || null,
      grade: admission.grade || stageLabelForSeat,
      createdAt: FieldValue.serverTimestamp(),
    });
    batch.set(db.collection('students').doc(studentRef.id).collection('ledger').doc(), {
      date: new Date().toISOString().slice(0, 10),
      item: `حجز مقعد${stageLabelForSeat ? ` — ${stageLabelForSeat}` : ''}`,
      debitMinorUnits: seatFee,
      creditMinorUnits: 0,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();

  const studentForPlacement = {
    id: studentRef.id,
    name: admission.name,
    displayId,
    grade: admission.grade || admission.stageLabel || 'الأول الأساسي',
    stageLabel: admission.stageLabel || admission.grade || 'الأول الأساسي',
    classSection: admission.classSection || null,
    shift: 'صباحي',
    status: 'نشط',
  };
  let placement = { enrolled: 0, matched: 0 };
  let tuitionPlan = { created: 0, monthly: monthlyTuition };
  try {
    placement = await enrollStudentInMatchingClassesAdmin(studentForPlacement);
  } catch (err) {
    console.error('auto-enroll on acceptAdmission failed', err);
  }
  try {
    if (monthlyTuition > 0) {
      tuitionPlan = await createAcademicYearTuitionPlanAdmin({
        studentId: studentRef.id,
        studentName: admission.name,
        stageId,
        stageLabel: stageLabelForSeat,
        classSection: admission.classSection || null,
        grade: admission.grade || stageLabelForSeat,
        academicYear: admission.academicYear || null,
        monthlyTuitionMinorUnits: monthlyTuition,
      });
    }
  } catch (err) {
    console.error('tuition plan on acceptAdmission failed', err);
  }

  await logActivity({
    type: 'admission_accepted', actorUid, actorName: actor?.name, actorRole: actor?.role,
    summary: [
      `قبول تسجيل: ${admission.name} — أُنشئ برقم ${displayId}`,
      placement.enrolled > 0 ? `· توزيع على ${placement.enrolled} صف` : '',
      seatFee > 0 ? '· حجز مقعد' : '',
      tuitionPlan.created > 0 ? `· ${tuitionPlan.created} قسطاً شهرياً` : '',
    ].filter(Boolean).join(' '),
    targetType: 'student', targetId: studentRef.id,
  });

  // Student portal no longer needs the temp password; keep returning it for
  // backwards compatibility with any admin UI that still displays it.
  return {
    studentId: studentRef.id,
    displayId,
    tempPassword,
    guardianUid,
    seatFeeMinorUnits: seatFee,
    monthlyTuitionMinorUnits: monthlyTuition,
    classesEnrolled: placement.enrolled,
    tuitionMonthsCreated: tuitionPlan.created || 0,
  };
});

// ─────────────────────────────────────────────────────────────────────────
// Passwordless portal login (parent phone / student study ID)
// Staff (admin / teacher / accountant) keep email + password.
// ─────────────────────────────────────────────────────────────────────────

export const issuePortalToken = onCall({ cors: true }, async (request) => {
  try {
    return await issuePortalTokenHandler(request);
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error('issuePortalToken failed', err);
    const msg = String(err?.message || err || '');
    if (msg.includes('signBlob') || msg.includes('insufficient-permission')) {
      throw new HttpsError(
        'failed-precondition',
        'إعدادات الخادم غير مكتملة لتسجيل الدخول. تواصل مع الإدارة.',
      );
    }
    throw new HttpsError('internal', 'تعذّر تسجيل الدخول حالياً. حاول مجدداً.');
  }
});

function normalizeStudentDisplayId(raw) {
  const s = String(raw || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!s) return null;
  if (/^\d{3,6}$/.test(s)) return `STU-${s}`;
  if (/^STU-?\d+$/i.test(s)) return s.replace(/^STU-?/i, 'STU-');
  const digits = s.replace(/\D/g, '');
  if (digits.length >= 3 && digits.length <= 6) return `STU-${digits}`;
  return null;
}

async function issuePortalTokenHandler(request) {
  const { role, identifier } = request.data || {};
  if (!role || !identifier) {
    throw new HttpsError('invalid-argument', 'الدور ومعرّف الدخول مطلوبان.');
  }
  if (role !== 'student' && role !== 'parent') {
    throw new HttpsError('invalid-argument', 'الدخول بدون كلمة سر متاح لولي الأمر والطالب فقط.');
  }

  // Prefer custom tokens; if the runtime SA lacks signBlob, fall back to a
  // one-time password handed to the client over HTTPS for immediate sign-in.
  async function mintSession(uid) {
    try {
      const token = await auth.createCustomToken(uid, { role, portal: true });
      return { mode: 'token', token };
    } catch (err) {
      const msg = String(err?.message || '');
      if (!msg.includes('signBlob') && !msg.includes('insufficient-permission')) throw err;
      console.warn('createCustomToken unavailable — using one-time password fallback');
      const oneTime = `Ot-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}!`;
      const user = await auth.getUser(uid);
      if (!user.email) throw new HttpsError('failed-precondition', 'حساب الدخول بلا بريد داخلي.');
      await auth.updateUser(uid, { password: oneTime });
      return { mode: 'password', email: user.email, password: oneTime };
    }
  }

  if (role === 'student') {
    const normalized = normalizeStudentDisplayId(identifier);
    if (!normalized) {
      throw new HttpsError('invalid-argument', 'أدخل الرقم الدراسي فقط، مثل 1227.');
    }
    const snap = await db.collection('students').where('displayId', '==', normalized).limit(1).get();
    if (snap.empty) {
      throw new HttpsError('not-found', 'الرقم الدراسي غير موجود.');
    }
    const student = { id: snap.docs[0].id, ...snap.docs[0].data() };
    const uid = await ensureStudentAuthUser(student);
    const session = await mintSession(uid);
    return { ...session, role: 'student', displayId: student.displayId || normalized };
  }

  // Parent — phone only
  const phoneKey = phoneKeyFromAny(identifier);
  if (!phoneKey) {
    throw new HttpsError('invalid-argument', 'أدخل رقم جوال صحيح مثل 0592799888.');
  }
  const students = await findStudentsByPhoneKey(phoneKey);
  if (students.length === 0) {
    throw new HttpsError('not-found', 'لا يوجد أبناء مرتبطون بهذا الرقم. تأكد من رقم الجوال المسجّل لدى المدرسة.');
  }
  const parentUid = await ensureParentAuthUser({
    phoneKey,
    name: students[0].guardianName || null,
    students,
  });
  await linkStudentsToParent(students, parentUid, phoneKey);
  const session = await mintSession(parentUid);
  return { ...session, role: 'parent', childrenCount: students.length };
}

// ─────────────────────────────────────────────────────────────────────────
// Staff / parent account provisioning (used by admin onboarding flows)
// ─────────────────────────────────────────────────────────────────────────

export const createStaffAccount = onCall(async (request) => {
  const { uid: actorUid, user: actor } = await requirePermission(request, ['users.manage', 'staff.manage']);
  const {
    email, name, role, title, childStudentIds, password,
    // Optional payroll fields (from الموظفون والأجور)
    salaryType, monthlySalaryMinorUnits, hourlyRateMinorUnits, dailyRateMinorUnits,
    hoursPerMonth, phone, notes,
  } = request.data || {};
  if (!email || !name || !role) throw new HttpsError('invalid-argument', 'الاسم والبريد والدور مطلوبة.');
  if (!['admin', 'director', 'teacher', 'accountant', 'parent', 'reception'].includes(role)) {
    throw new HttpsError('invalid-argument', 'دور غير معروف.');
  }

  // staff.manage alone may only provision portal workers (not admin/parent).
  const canManageUsers = effectivePermission(actor, 'users.manage');
  if (!canManageUsers && !['teacher', 'accountant', 'reception', 'director'].includes(role)) {
    throw new HttpsError('permission-denied', 'صلاحية الموظفين تسمح بإنشاء معلّم أو محاسب أو استقبال أو مديرة فقط.');
  }

  const chosen = typeof password === 'string' ? password.trim() : '';
  if (chosen && chosen.length < 6) {
    throw new HttpsError('invalid-argument', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
  }
  const tempPassword = chosen || randomTempPassword();
  let authUser;
  try {
    authUser = await auth.createUser({ email, password: tempPassword, displayName: name });
  } catch (err) {
    if (err?.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'هذا البريد مستخدم مسبقاً.');
    }
    throw err;
  }

  const defaultTitle = role === 'director' ? 'مديرة'
    : role === 'teacher' ? 'معلّم'
      : role === 'accountant' ? 'محاسب'
        : role === 'reception' ? 'استقبال'
          : '';

  const staffTitle = (title || defaultTitle || 'موظف').trim();
  const resolvedSalaryType = ['monthly', 'hourly', 'daily'].includes(salaryType) ? salaryType : 'monthly';
  const monthly = resolvedSalaryType === 'monthly'
    ? (Number(monthlySalaryMinorUnits) || (role === 'teacher' ? 50000 : 45000))
    : null;
  const hourly = resolvedSalaryType === 'hourly' ? (Number(hourlyRateMinorUnits) || 0) : null;
  const daily = resolvedSalaryType === 'daily' ? (Number(dailyRateMinorUnits) || 0) : null;
  const base = monthly || hourly || daily || 0;
  const legacyType = resolvedSalaryType === 'hourly' ? 'أجر ساعة'
    : resolvedSalaryType === 'daily' ? 'راتب يومي' : 'راتب شهري';

  const batch = db.batch();
  batch.set(db.collection('users').doc(authUser.uid), {
    role,
    name,
    title: staffTitle,
    email,
    permissions: ROLE_DEFAULT_PERMISSIONS[role] || {},
    createdAt: FieldValue.serverTimestamp(),
  });
  if (role === 'teacher' || role === 'accountant' || role === 'reception' || role === 'director') {
    const roleType = role;
    batch.set(db.collection('staff').doc(authUser.uid), {
      name,
      role: staffTitle,
      jobTitleAr: staffTitle,
      roleType,
      salaryType: resolvedSalaryType,
      type: legacyType,
      monthlySalaryMinorUnits: monthly,
      hourlyRateMinorUnits: hourly,
      dailyRateMinorUnits: daily,
      hoursPerMonth: resolvedSalaryType === 'hourly' ? (Number(hoursPerMonth) || 160) : null,
      baseMinorUnits: base,
      phone: (phone || '').trim() || null,
      notes: (notes || '').trim() || null,
      authUid: authUser.uid,
      active: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  if (role === 'teacher') {
    batch.set(db.collection('teacherProfiles').doc(authUser.uid), {
      name, subject: title || '—', bio: '', email, phone: (phone || '').trim() || '', initial: (name || 'م').trim().charAt(0),
    }, { merge: true });
  }
  if (role === 'parent' && Array.isArray(childStudentIds)) {
    for (const studentId of childStudentIds) {
      batch.update(db.collection('students').doc(studentId), { guardianUid: authUser.uid });
    }
  }
  await batch.commit();
  await logActivity({
    type: 'staff_created', actorUid, actorName: actor?.name, actorRole: actor?.role,
    summary: `إنشاء حساب موظّف: ${name} (${role})`,
    targetType: 'user', targetId: authUser.uid,
  });

  return { uid: authUser.uid, tempPassword, email, role };
});

export const updateStaffAccount = onCall(async (request) => {
  const { uid: actorUid, user: actor } = await requirePermission(request, 'users.manage');
  const { uid, name, title, email, password, role, permissions } = request.data || {};
  if (!uid) throw new HttpsError('invalid-argument', 'معرّف المستخدم مطلوب.');
  if (uid === actorUid && role && role !== actor.role && actor.role === 'admin') {
    // Allow admin to change own title/name/email/password, but not drop admin role accidentally via empty checks below
  }

  const userRef = db.collection('users').doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'المستخدم غير موجود.');
  const existing = snap.data() || {};

  if (existing.role === 'admin' && actor.role !== 'admin') {
    throw new HttpsError('permission-denied', 'لا يمكن تعديل حساب الإدارة إلا من حساب إدارة.');
  }

  const nextRole = role || existing.role;
  if (!['admin', 'director', 'teacher', 'accountant', 'reception'].includes(nextRole)) {
    throw new HttpsError('invalid-argument', 'دور غير معروف.');
  }

  // Prevent stripping the last admin
  if (existing.role === 'admin' && nextRole !== 'admin') {
    const admins = await db.collection('users').where('role', '==', 'admin').limit(2).get();
    if (admins.size <= 1) {
      throw new HttpsError('failed-precondition', 'لا يمكن تغيير دور آخر حساب إدارة في النظام.');
    }
  }
  if (uid === actorUid && nextRole !== 'admin' && actor.role === 'admin') {
    const admins = await db.collection('users').where('role', '==', 'admin').limit(2).get();
    if (admins.size <= 1) {
      throw new HttpsError('failed-precondition', 'لا يمكن إزالة صلاحية الإدارة عن حسابك وهو الحساب الوحيد.');
    }
  }

  const nextName = (name != null ? String(name) : existing.name || '').trim();
  const nextTitle = (title != null ? String(title) : existing.title || '').trim();
  const nextEmail = (email != null ? String(email).trim().toLowerCase() : (existing.email || '')).trim();
  if (!nextName) throw new HttpsError('invalid-argument', 'الاسم مطلوب.');
  if (!nextEmail) throw new HttpsError('invalid-argument', 'البريد مطلوب.');

  const chosen = typeof password === 'string' ? password.trim() : '';
  if (chosen && chosen.length < 6) {
    throw new HttpsError('invalid-argument', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
  }

  const authPatch = { displayName: nextName, email: nextEmail };
  if (chosen) authPatch.password = chosen;
  try {
    await auth.updateUser(uid, authPatch);
  } catch (err) {
    if (err?.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'هذا البريد مستخدم مسبقاً.');
    }
    if (err?.code === 'auth/invalid-email') {
      throw new HttpsError('invalid-argument', 'البريد الإلكتروني غير صالح.');
    }
    throw err;
  }

  const userPatch = {
    name: nextName,
    title: nextTitle,
    email: nextEmail,
    role: nextRole,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (nextRole === 'admin') {
    userPatch.permissions = {};
  } else if (permissions && typeof permissions === 'object') {
    userPatch.permissions = permissions;
  } else if (role && role !== existing.role) {
    userPatch.permissions = ROLE_DEFAULT_PERMISSIONS[nextRole] || {};
  }

  const batch = db.batch();
  batch.set(userRef, userPatch, { merge: true });

  const staffRef = db.collection('staff').doc(uid);
  const staffSnap = await staffRef.get();
  if (staffSnap.exists) {
    batch.set(staffRef, {
      name: nextName,
      role: nextTitle || nextName,
      jobTitleAr: nextTitle || staffSnap.data()?.jobTitleAr || nextName,
      roleType: ['teacher', 'accountant', 'reception', 'director'].includes(nextRole) ? nextRole : (staffSnap.data()?.roleType || 'other'),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  if (nextRole === 'teacher') {
    batch.set(db.collection('teacherProfiles').doc(uid), {
      name: nextName,
      email: nextEmail,
      subject: nextTitle || '—',
      initial: nextName.charAt(0) || 'م',
    }, { merge: true });
  }

  await batch.commit();
  await logActivity({
    type: 'staff_updated', actorUid, actorName: actor?.name, actorRole: actor?.role,
    summary: `تعديل مستخدم: ${nextName} (${nextRole})`,
    targetType: 'user', targetId: uid,
  });

  return { uid, email: nextEmail, role: nextRole, passwordChanged: !!chosen };
});

export const deleteStaffAccount = onCall(async (request) => {
  const { uid: actorUid, user: actor } = await requirePermission(request, 'users.manage');
  const { uid } = request.data || {};
  if (!uid) throw new HttpsError('invalid-argument', 'معرّف المستخدم مطلوب.');
  if (uid === actorUid) {
    throw new HttpsError('failed-precondition', 'لا يمكنك حذف حسابك الحالي.');
  }

  const userRef = db.collection('users').doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'المستخدم غير موجود.');
  const existing = snap.data() || {};

  if (existing.role === 'admin' && actor.role !== 'admin') {
    throw new HttpsError('permission-denied', 'لا يمكن حذف حساب الإدارة إلا من حساب إدارة.');
  }
  if (existing.role === 'admin') {
    const admins = await db.collection('users').where('role', '==', 'admin').limit(2).get();
    if (admins.size <= 1) {
      throw new HttpsError('failed-precondition', 'لا يمكن حذف آخر حساب إدارة في النظام.');
    }
  }

  const batch = db.batch();
  batch.delete(userRef);

  const staffRef = db.collection('staff').doc(uid);
  const staffSnap = await staffRef.get();
  if (staffSnap.exists) {
    batch.set(staffRef, {
      active: false,
      authUid: null,
      notes: [staffSnap.data()?.notes, 'حساب الدخول حُذف'].filter(Boolean).join(' · '),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  const teacherRef = db.collection('teacherProfiles').doc(uid);
  const teacherSnap = await teacherRef.get();
  if (teacherSnap.exists) batch.delete(teacherRef);

  await batch.commit();

  try {
    await auth.deleteUser(uid);
  } catch (err) {
    if (err?.code !== 'auth/user-not-found') throw err;
  }

  await logActivity({
    type: 'staff_deleted', actorUid, actorName: actor?.name, actorRole: actor?.role,
    summary: `حذف مستخدم: ${existing.name || uid} (${existing.role || '—'})`,
    targetType: 'user', targetId: uid,
  });

  return { uid, deleted: true };
});

// ─────────────────────────────────────────────────────────────────────────
// Billing — idempotent invoice generation
// ─────────────────────────────────────────────────────────────────────────

const DEFAULT_FEE_MINOR_UNITS = 40000; // ₪400 fallback tuition when no stage fee is set

function resolveTuition(student, feeByStageId, feeByLabel, stageDocs) {
  // 1) Exact stageId match (preferred)
  if (student.stageId && feeByStageId.has(student.stageId)) {
    const v = feeByStageId.get(student.stageId);
    if (v != null) return v;
  }
  // 2) stageLabel / feeTemplates legacy doc id
  const label = student.stageLabel || (student.grade || '').split('/')[0].trim();
  if (label && feeByLabel.has(label)) {
    const v = feeByLabel.get(label);
    if (v != null) return v;
  }
  // 3) Match academicStages by labelAr
  const stage = stageDocs.find((s) => s.labelAr === label || s.labelAr === student.stageLabel);
  if (stage?.monthlyTuitionMinorUnits != null) return stage.monthlyTuitionMinorUnits;
  // 4) Prefix match on grade string (e.g. "الخامس / أ" → stage "الخامس الأساسي")
  const grade = student.grade || '';
  for (const s of stageDocs) {
    if (s.labelAr && grade.startsWith(s.labelAr.split(' ')[0]) && s.monthlyTuitionMinorUnits != null) {
      return s.monthlyTuitionMinorUnits;
    }
  }
  return DEFAULT_FEE_MINOR_UNITS;
}

export const generateInvoices = onCall(async (request) => {
  const { uid: actorUid, user: actor } = await requirePermission(request, 'billing.manage');
  const { period } = request.data || {};
  if (!period) throw new HttpsError('invalid-argument', 'period مطلوب (مثال: 2026-10).');

  const [studentsSnap, feeTemplatesSnap, stagesSnap] = await Promise.all([
    db.collection('students').where('status', '==', 'نشط').get(),
    db.collection('feeTemplates').get(),
    db.collection('academicStages').get(),
  ]);

  const stageDocs = stagesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const feeByStageId = new Map();
  const feeByLabel = new Map();
  for (const s of stageDocs) {
    if (s.monthlyTuitionMinorUnits != null) {
      feeByStageId.set(s.id, s.monthlyTuitionMinorUnits);
      if (s.labelAr) feeByLabel.set(s.labelAr, s.monthlyTuitionMinorUnits);
    }
  }
  // Legacy feeTemplates/{gradeLabel}
  for (const d of feeTemplatesSnap.docs) {
    const tuition = d.data().tuitionMinorUnits ?? d.data().monthlyTuitionMinorUnits;
    if (tuition != null) feeByLabel.set(d.id, tuition);
  }

  let created = 0;
  let skipped = 0;
  for (const studentDoc of studentsSnap.docs) {
    const student = studentDoc.data();
    const chargeId = `${studentDoc.id}_${period}_tuition`;
    const chargeRef = db.collection('charges').doc(chargeId);
    const fee = resolveTuition(student, feeByStageId, feeByLabel, stageDocs);

    // eslint-disable-next-line no-await-in-loop
    const existing = await chargeRef.get();
    if (existing.exists) { skipped += 1; continue; }

    // eslint-disable-next-line no-await-in-loop
    await db.runTransaction(async (tx) => {
      const [y, m] = String(period).split('-').map(Number);
      const MONTH_AR = {
        1: 'كانون الثاني', 2: 'شباط', 3: 'آذار', 4: 'نيسان', 5: 'أيار', 6: 'حزيران',
        9: 'أيلول', 10: 'تشرين الأول', 11: 'تشرين الثاني', 12: 'كانون الأول',
      };
      const periodLabelAr = `${MONTH_AR[m] || m} ${y}`;
      tx.set(chargeRef, {
        studentId: studentDoc.id, student: student.name, period,
        periodLabel: periodLabelAr,
        type: 'رسوم دراسية شهرية',
        stageId: student.stageId || null, stageLabel: student.stageLabel || null,
        classSection: student.classSection || null, grade: student.grade || null,
        amountMinorUnits: fee, discountMinorUnits: 0, status: 'مسودّة', method: '—',
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.set(db.collection('students').doc(studentDoc.id).collection('ledger').doc(), {
        date: period, item: `رسوم شهر ${periodLabelAr}`, debitMinorUnits: fee, creditMinorUnits: 0,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.update(db.collection('students').doc(studentDoc.id), {
        balanceMinorUnits: FieldValue.increment(fee),
      });
    });
    created += 1;
  }

  if (created > 0) {
    await logActivity({
      type: 'invoice_generated', actorUid, actorName: actor?.name, actorRole: actor?.role,
      summary: `توليد فواتير الفترة ${period} — ${created} فاتورة جديدة حسب رسوم المرحلة`,
      targetType: 'billing', targetId: period,
    });
  }
  return { created, skipped, period };
});

// ─────────────────────────────────────────────────────────────────────────
// Payroll — stage machine: open → computed → approved → paid
// ─────────────────────────────────────────────────────────────────────────

async function payrollDocsForPeriod(period, stage) {
  const snap = await db.collection('payroll').where('period', '==', period).where('stage', '==', stage).get();
  return snap.docs;
}

export const computePayroll = onCall(async (request) => {
  await requirePermission(request, 'payroll.manage');
  const { period } = request.data || {};
  if (!period) throw new HttpsError('invalid-argument', 'period مطلوب.');

  const staffSnap = await db.collection('staff').get();
  let computed = 0;
  for (const staffDoc of staffSnap.docs) {
    const staff = staffDoc.data();
    if (staff.active === false) continue;

    // eslint-disable-next-line no-await-in-loop
    const attendanceSnap = await staffDoc.ref.collection('attendance').doc(period).get();
    const att = attendanceSnap.exists ? attendanceSnap.data() : {};
    const daysPresent = att.daysPresent ?? 22;
    const workingDays = att.workingDays ?? 22;
    const hoursWorked = att.hoursWorked;

    const salaryType = staff.salaryType
      || (staff.type === 'راتب يومي' ? 'daily' : staff.type === 'أجر ساعة' ? 'hourly' : 'monthly');

    let net = 0;
    let daysLabel = `${daysPresent} / ${workingDays}`;
    let base = staff.baseMinorUnits || 0;
    let typeLabel = staff.type || 'راتب شهري';

    if (salaryType === 'hourly') {
      const rate = staff.hourlyRateMinorUnits || staff.baseMinorUnits || 0;
      const hours = hoursWorked != null ? hoursWorked : (staff.hoursPerMonth || 160);
      net = Math.round(rate * hours);
      base = rate;
      daysLabel = `${hours} ساعة`;
      typeLabel = 'أجر ساعة';
    } else if (salaryType === 'daily') {
      const rate = staff.dailyRateMinorUnits || staff.baseMinorUnits || 0;
      net = rate * daysPresent;
      base = rate;
      daysLabel = `${daysPresent}`;
      typeLabel = 'راتب يومي';
    } else {
      const monthly = staff.monthlySalaryMinorUnits || staff.baseMinorUnits || 0;
      net = Math.round((monthly * daysPresent) / workingDays);
      base = monthly;
      typeLabel = 'راتب شهري';
    }

    // eslint-disable-next-line no-await-in-loop
    await db.collection('payroll').doc(`${staffDoc.id}_${period}`).set({
      staffId: staffDoc.id,
      period,
      name: staff.name,
      role: staff.jobTitleAr || staff.role,
      roleType: staff.roleType || 'other',
      type: typeLabel,
      salaryType,
      category: 'salary',
      days: daysLabel,
      baseMinorUnits: base,
      adjustmentMinorUnits: 0,
      netMinorUnits: net,
      stage: 'computed',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    computed += 1;
  }
  return { computed, period };
});

export const approvePayroll = onCall(async (request) => {
  await requirePermission(request, 'payroll.manage');
  const { period } = request.data || {};
  const docs = await payrollDocsForPeriod(period, 'computed');
  await Promise.all(docs.map((d) => d.ref.update({ stage: 'approved', approvedAt: FieldValue.serverTimestamp() })));
  return { approved: docs.length, period };
});

export const disbursePayroll = onCall(async (request) => {
  await requirePermission(request, 'payroll.manage');
  const { period } = request.data || {};
  const docs = await payrollDocsForPeriod(period, 'approved');
  await Promise.all(docs.map((d) => d.ref.update({ stage: 'paid', paidAt: FieldValue.serverTimestamp() })));
  return { paid: docs.length, period };
});

/**
 * A callable rather than an HTTP endpoint on purpose: exporting via
 * onRequest needs the Cloud Run/Functions invoker IAM policy set to public,
 * which requires a `setIamPolicy` grant most deploy service accounts don't
 * have. Callable functions carry their own auth and need no such grant.
 * Returns CSV text; the client turns it into a download client-side.
 */
export const payrollExport = onCall(async (request) => {
  await requirePermission(request, 'payroll.manage');
  const { period } = request.data || {};
  if (!period) throw new HttpsError('invalid-argument', 'period مطلوب.');

  const snap = await db.collection('payroll').where('period', '==', period).where('stage', '==', 'paid').get();
  const rows = ['name,role,type,days,net_minor_units'];
  snap.forEach((d) => {
    const p = d.data();
    rows.push([p.name, p.role, p.type, p.days, p.netMinorUnits].join(','));
  });
  return { csv: rows.join('\n'), filename: `payroll-${period}.csv` };
});

// System backup / wipe (admin only)
export {
  exportSystemBackup,
  importSystemBackup,
  wipeSystemData,
} from './backup.js';

