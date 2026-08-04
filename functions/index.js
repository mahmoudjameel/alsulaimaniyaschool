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

/**
 * Two-layer authorization, mirrored from firestore.rules: `role === 'admin'`
 * always passes; otherwise the caller's `users/{uid}.permissions[key]` map
 * (set by an admin from the "المستخدمون والصلاحيات" screen) decides. This
 * keeps a staff member's Cloud Function access consistent with what their
 * granted permissions already let them do directly in Firestore.
 */
async function requirePermission(request, key) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول.');
  const user = (await db.collection('users').doc(uid).get()).data();
  if (user?.role !== 'admin' && !user?.permissions?.[key]) {
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
    ageYears: admission.ageYears != null ? admission.ageYears : null,
    displayId,
    guardianName: admission.guardian || '—',
    guardianPhone: admission.phoneE164 || admission.phone || null,
    guardianPhoneDial: admission.phoneDial || null,
    guardianPhoneLocal: admission.phoneLocal || (phoneKey ? `0${phoneKey}` : null),
    guardianPhoneE164: admission.phoneE164 || admission.phone || null,
    guardianPhoneWa: admission.phoneWa || null,
    guardianPhoneKey: phoneKey,
    guardianUid,
    grade: admission.grade || admission.stageLabel || 'الأول الأساسي',
    shift: 'صباحي',
    status: 'نشط',
    balanceMinorUnits: 0,
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
  await batch.commit();
  await logActivity({
    type: 'admission_accepted', actorUid, actorName: actor?.name, actorRole: actor?.role,
    summary: `قبول تسجيل: ${admission.name} — أُنشئ برقم ${displayId}`,
    targetType: 'student', targetId: studentRef.id,
  });

  // Student portal no longer needs the temp password; keep returning it for
  // backwards compatibility with any admin UI that still displays it.
  return { studentId: studentRef.id, displayId, tempPassword, guardianUid };
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

// Kept in sync by hand with src/lib/permissions.js (that file can't be
// imported here — it's bundled for the browser — so this is the one place
// the default permission set is duplicated; the admin UI is the source of
// truth for anything beyond these starting defaults).
const ROLE_DEFAULT_PERMISSIONS = {
  admin: {
    'admissions.manage': true, 'students.manage': true, 'stages.manage': true, 'enrollment.manage': true,
    'billing.manage': true, 'payments.manage': true, 'payroll.manage': true, 'staff.manage': true,
    'disbursements.manage': true, 'expenses.manage': true, 'classes.manage': true, 'teachers.manage': true,
    'grades.approve': true, 'cms.manage': true, 'users.manage': true, 'activity.view': true,
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

export const createStaffAccount = onCall(async (request) => {
  const { uid: actorUid, user: actor } = await requirePermission(request, 'users.manage');
  const { email, name, role, title, childStudentIds } = request.data || {};
  if (!email || !name || !role) throw new HttpsError('invalid-argument', 'الاسم والبريد والدور مطلوبة.');
  if (!['admin', 'teacher', 'accountant', 'parent', 'reception'].includes(role)) throw new HttpsError('invalid-argument', 'دور غير معروف.');

  const tempPassword = randomTempPassword();
  const authUser = await auth.createUser({ email, password: tempPassword, displayName: name });

  const batch = db.batch();
  batch.set(db.collection('users').doc(authUser.uid), {
    role, name, title: title || '', email, permissions: ROLE_DEFAULT_PERMISSIONS[role] || {},
    createdAt: FieldValue.serverTimestamp(),
  });
  if (role === 'teacher' || role === 'accountant' || role === 'reception') {
    const roleType = role === 'teacher' ? 'teacher' : role === 'accountant' ? 'accountant' : 'reception';
    const defaultTitle = role === 'teacher' ? 'معلّم' : role === 'accountant' ? 'محاسب' : 'استقبال';
    batch.set(db.collection('staff').doc(authUser.uid), {
      name,
      role: title || defaultTitle,
      jobTitleAr: title || defaultTitle,
      roleType,
      salaryType: 'monthly',
      type: 'راتب شهري',
      monthlySalaryMinorUnits: role === 'teacher' ? 50000 : 45000,
      baseMinorUnits: role === 'teacher' ? 50000 : 45000,
      authUid: authUser.uid,
      active: true,
    });
  }
  if (role === 'teacher') {
    batch.set(db.collection('teacherProfiles').doc(authUser.uid), {
      name, subject: title || '—', bio: '', email, phone: '', initial: (name || 'م').trim().charAt(0),
    });
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

  return { uid: authUser.uid, tempPassword };
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
      tx.set(chargeRef, {
        studentId: studentDoc.id, student: student.name, period, type: 'رسوم دراسية شهرية',
        stageId: student.stageId || null, stageLabel: student.stageLabel || null,
        amountMinorUnits: fee, discountMinorUnits: 0, status: 'مسودّة', method: '—',
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.set(db.collection('students').doc(studentDoc.id).collection('ledger').doc(), {
        date: period, item: `رسوم دراسية شهرية — ${period}`, debitMinorUnits: fee, creditMinorUnits: 0,
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
