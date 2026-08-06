#!/usr/bin/env node
/**
 * ينشئ حساب ولي أمر + أبناؤه مع بيانات كاملة تظهر في كل شاشات البوابة:
 * درجات مستمرة/اختبارات، حضور، ملاحظات، رسوم، خصم/تقسيط، وصول دفع،
 * تبرير غياب، واجبات دفتر اليوم، اختبارات معتمدة، إعلانات، وتنبيهات.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json node scripts/seed-parent-family.mjs
 *   # أو ضع المفتاح في ./serviceAccountKey.json
 *   # أو سيُبحث تلقائياً عن burouto-firebase-adminsdk*.json في Downloads
 *
 * دخول ولي الأمر: /login/parent  ← رقم الجوال أدناه (بدون كلمة مرور)
 * دخول الأبناء:   /login/student ← الرقم الدراسي (بدون كلمة مرور)
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { CURRENT_ACADEMIC_YEAR, studentIdToAuthEmail } from '../src/lib/constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ─── Family credentials (ثابتة وسهلة للتجربة) ─────────────────────────────
const FAMILY = {
  parent: {
    name: 'محمد السليماني',
    phoneLocal: '0599123456',
    phoneDial: '970',
    phoneKey: '599123456',
    phoneE164: '+970599123456',
    phoneWa: '970599123456',
    title: 'ولي أمر',
    residentialAddress: 'غزة، الرمال — شارع الجلاء',
    guardianWorkStatus: 'يعمل',
    housingType: 'ملك',
  },
  children: [
    {
      id: 'fam-ahmad',
      name: 'أحمد محمد السليماني',
      nameFirst: 'أحمد',
      nameFather: 'محمد',
      nameGrandfather: 'محمود',
      nameFamily: 'السليماني',
      displayId: 'STU-2001',
      nationalId: '409112233',
      stageLabel: 'الخامس الأساسي',
      classSection: 'أ',
      grade: 'الخامس / أ',
      shift: 'صباحي',
      ageYears: 11,
      balanceMinorUnits: 25000,
      initial: 'أ',
    },
    {
      id: 'fam-noor',
      name: 'نور محمد السليماني',
      nameFirst: 'نور',
      nameFather: 'محمد',
      nameGrandfather: 'محمود',
      nameFamily: 'السليماني',
      displayId: 'STU-2002',
      nationalId: '409223344',
      stageLabel: 'الروضة',
      classSection: 'أ',
      grade: 'الروضة',
      shift: 'صباحي',
      ageYears: 5,
      balanceMinorUnits: 0,
      initial: 'ن',
    },
  ],
};

const PARENT_AUTH_EMAIL = `p-${FAMILY.parent.phoneKey}@parents.sulaimaniya.local`;
const YEAR = CURRENT_ACADEMIC_YEAR;
const TERM = 'الفصل الأول';
const TEACHER = {
  id: 'fam-teacher',
  name: 'أ. خالد الأحمد',
  subject: 'لغة عربية',
};

function resolveCredential() {
  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    join(ROOT, 'serviceAccountKey.json'),
    join(homedir(), 'Downloads', 'burouto-firebase-adminsdk-f6n7u-e47d2acbe6.json'),
  ].filter(Boolean);

  const downloads = join(homedir(), 'Downloads');
  if (existsSync(downloads)) {
    try {
      for (const name of readdirSync(downloads)) {
        if (/^burouto-firebase-adminsdk.*\.json$/i.test(name)) {
          candidates.push(join(downloads, name));
        }
      }
    } catch { /* ignore */ }
  }

  for (const p of candidates) {
    if (p && existsSync(p)) {
      console.log('→ Using service account:', p);
      return cert(JSON.parse(readFileSync(p, 'utf8')));
    }
  }
  console.log('→ Falling back to applicationDefault()');
  return applicationDefault();
}

initializeApp({ credential: resolveCredential() });
const db = getFirestore();
const auth = getAuth();

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

async function upsertAuthByEmail(email, displayName) {
  try {
    const u = await auth.getUserByEmail(email);
    await auth.updateUser(u.uid, { displayName });
    return u;
  } catch {
    return auth.createUser({ email, password: `Tmp-${Math.random().toString(36).slice(2)}9!`, displayName });
  }
}

async function wipeFamilyDocs() {
  // Idempotent: overwrite known family IDs; clear prior subcollections lightly
  console.log('→ Preparing family document IDs…');
}

async function ensureSchoolCalendar() {
  await db.collection('schoolSettings').doc('main').set({
    academicYear: YEAR,
    activeTerm: TERM,
    closedTerms: [],
    nameAr: 'مدرسة السليمانية',
    locationLabelAr: 'غزة، الرمال — فلسطين',
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function createParent() {
  console.log('→ Creating parent account…');
  const user = await upsertAuthByEmail(PARENT_AUTH_EMAIL, FAMILY.parent.name);
  await db.collection('users').doc(user.uid).set({
    role: 'parent',
    name: FAMILY.parent.name,
    title: FAMILY.parent.title,
    phoneKey: FAMILY.parent.phoneKey,
    phoneLocal: FAMILY.parent.phoneLocal,
    phoneDial: FAMILY.parent.phoneDial,
    phoneE164: FAMILY.parent.phoneE164,
    phoneWa: FAMILY.parent.phoneWa,
    residentialAddress: FAMILY.parent.residentialAddress,
    guardianWorkStatus: FAMILY.parent.guardianWorkStatus,
    housingType: FAMILY.parent.housingType,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return user;
}

async function createStudentAuth(child) {
  const email = studentIdToAuthEmail(child.displayId);
  return upsertAuthByEmail(email, child.name);
}

async function seedChildren(parentUid, studentAuthById) {
  console.log('→ Creating children + profiles…');
  for (const child of FAMILY.children) {
    const stuAuth = studentAuthById[child.id];
    await db.collection('students').doc(child.id).set({
      name: child.name,
      nameFirst: child.nameFirst,
      nameFather: child.nameFather,
      nameGrandfather: child.nameGrandfather,
      nameFamily: child.nameFamily,
      displayId: child.displayId,
      nationalId: child.nationalId,
      stageLabel: child.stageLabel,
      classSection: child.classSection,
      grade: child.grade,
      shift: child.shift,
      ageYears: child.ageYears,
      academicYear: YEAR,
      status: 'نشط',
      balanceMinorUnits: child.balanceMinorUnits,
      initial: child.initial,
      guardianName: FAMILY.parent.name,
      guardianUid: parentUid,
      studentUid: stuAuth.uid,
      guardianPhoneLocal: FAMILY.parent.phoneLocal,
      guardianPhoneDial: FAMILY.parent.phoneDial,
      guardianPhoneE164: FAMILY.parent.phoneE164,
      guardianPhoneWa: FAMILY.parent.phoneWa,
      guardianPhoneKey: FAMILY.parent.phoneKey,
      guardianPhone: FAMILY.parent.phoneE164,
      residentialAddress: FAMILY.parent.residentialAddress,
      guardianWorkStatus: FAMILY.parent.guardianWorkStatus,
      housingType: FAMILY.parent.housingType,
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    await db.collection('users').doc(stuAuth.uid).set({
      role: 'student',
      name: child.name,
      displayId: child.displayId,
      studentId: child.id,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    // Guardians subcollection
    await db.collection('students').doc(child.id).collection('guardians').doc('primary').set({
      name: FAMILY.parent.name,
      relation: 'الأب',
      phone: FAMILY.parent.phoneLocal,
      primary: true,
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
}

async function seedClassesAndEnrollments() {
  console.log('→ Classes + enrollments…');
  const classes = [
    {
      id: 'fam-class-ar',
      subject: 'لغة عربية',
      title: 'القراءة والتعبير',
      teacher: TEACHER.name,
      teacherId: TEACHER.id,
      grade: 'الخامس الأساسي',
      shift: 'صباحي',
      schedule: [
        { day: 'الأحد', start: '08:00', end: '08:45' },
        { day: 'الثلاثاء', start: '08:00', end: '08:45' },
      ],
      forChild: 'fam-ahmad',
    },
    {
      id: 'fam-class-math',
      subject: 'رياضيات',
      title: 'الكسور والأعداد',
      teacher: 'أ. رنا عادل',
      teacherId: 'fam-teacher-math',
      grade: 'الخامس الأساسي',
      shift: 'صباحي',
      schedule: [
        { day: 'الاثنين', start: '09:00', end: '09:45' },
        { day: 'الأربعاء', start: '09:00', end: '09:45' },
      ],
      forChild: 'fam-ahmad',
    },
    {
      id: 'fam-class-kg',
      subject: 'تهيئة',
      title: 'أنشطة الروضة',
      teacher: 'أ. هدى مالك',
      teacherId: 'fam-teacher-kg',
      grade: 'الروضة',
      shift: 'صباحي',
      schedule: [{ day: 'الأحد', start: '08:30', end: '11:30' }],
      forChild: 'fam-noor',
    },
  ];

  for (const c of classes) {
    const child = FAMILY.children.find((x) => x.id === c.forChild);
    await db.collection('classes').doc(c.id).set({
      subject: c.subject,
      title: c.title,
      teacher: c.teacher,
      teacherId: c.teacherId,
      grade: c.grade,
      shift: c.shift,
      schedule: c.schedule,
      lessonsCount: 12,
      studentsCount: 1,
      visibility: 'المدرسة',
      academicYear: YEAR,
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    await db.collection('classes').doc(c.id).collection('enrollments').doc(child.id).set({
      studentId: child.id,
      studentName: child.name,
      displayId: child.displayId,
      grade: child.grade,
      enrolledAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    await db.collection('students').doc(child.id).collection('classes').doc(c.id).set({
      classId: c.id,
      subject: c.subject,
      title: c.title,
      teacher: c.teacher,
      teacherId: c.teacherId,
      shift: c.shift,
      grade: '—',
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  return classes;
}

async function seedDayLogs(classes) {
  console.log('→ Day logs (homework)…');
  const today = isoDate(new Date());
  const yesterday = isoDate(daysAgo(1));
  for (const c of classes) {
    await db.collection('classes').doc(c.id).collection('dayLogs').doc(today).set({
      date: today,
      classId: c.id,
      className: c.title,
      subject: c.subject,
      teacherId: c.teacherId,
      teacherName: c.teacher,
      topic: 'مراجعة الوحدة',
      homework: c.id === 'fam-class-kg'
        ? 'تلوين ورقة الحروف وإحضارها غداً'
        : 'حل تمارين الصفحة 24–25 وإحضار الدفتر',
      notice: 'يُرجى الالتزام بالزي المدرسي',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await db.collection('classes').doc(c.id).collection('dayLogs').doc(yesterday).set({
      date: yesterday,
      classId: c.id,
      className: c.title,
      subject: c.subject,
      teacherId: c.teacherId,
      teacherName: c.teacher,
      topic: 'درس تمهيدي',
      homework: 'قراءة الدرس بصوت عالٍ مع ولي الأمر',
      notice: '',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
}

async function seedGrades() {
  console.log('→ Grades (continuous + exams)…');
  const ahmad = FAMILY.children[0];
  const noor = FAMILY.children[1];
  const grades = [
    {
      id: 'fam-g-ahmad-daftar',
      studentId: ahmad.id, studentName: ahmad.name,
      classId: 'fam-class-ar', className: 'القراءة والتعبير', subject: 'لغة عربية',
      teacherId: TEACHER.id, teacherName: TEACHER.name,
      assessmentTitle: 'دفتر الأسبوع 3', assessmentType: 'دفتر',
      score: 9, maxScore: 10, term: TERM, status: 'معتمد',
    },
    {
      id: 'fam-g-ahmad-hudur',
      studentId: ahmad.id, studentName: ahmad.name,
      classId: 'fam-class-ar', className: 'القراءة والتعبير', subject: 'لغة عربية',
      teacherId: TEACHER.id, teacherName: TEACHER.name,
      assessmentTitle: 'حضور سبتمبر', assessmentType: 'حضور',
      score: 10, maxScore: 10, term: TERM, status: 'معتمد',
    },
    {
      id: 'fam-g-ahmad-nashat',
      studentId: ahmad.id, studentName: ahmad.name,
      classId: 'fam-class-math', className: 'الكسور والأعداد', subject: 'رياضيات',
      teacherId: 'fam-teacher-math', teacherName: 'أ. رنا عادل',
      assessmentTitle: 'مشاركة صفّية', assessmentType: 'نشاط',
      score: 8, maxScore: 10, term: TERM, status: 'معتمد',
    },
    {
      id: 'fam-g-ahmad-exam',
      studentId: ahmad.id, studentName: ahmad.name,
      classId: 'fam-class-ar', className: 'القراءة والتعبير', subject: 'لغة عربية',
      teacherId: TEACHER.id, teacherName: TEACHER.name,
      assessmentTitle: 'اختبار الوحدة الأولى', assessmentType: 'اختبار شهري',
      score: 88, maxScore: 100, term: TERM, status: 'معتمد',
    },
    {
      id: 'fam-g-ahmad-pending',
      studentId: ahmad.id, studentName: ahmad.name,
      classId: 'fam-class-math', className: 'الكسور والأعداد', subject: 'رياضيات',
      teacherId: 'fam-teacher-math', teacherName: 'أ. رنا عادل',
      assessmentTitle: 'فرض صفّي', assessmentType: 'فرض صفّي',
      score: 17, maxScore: 20, term: TERM, status: 'قيد المراجعة',
    },
    {
      id: 'fam-g-noor-nashat',
      studentId: noor.id, studentName: noor.name,
      classId: 'fam-class-kg', className: 'أنشطة الروضة', subject: 'تهيئة',
      teacherId: 'fam-teacher-kg', teacherName: 'أ. هدى مالك',
      assessmentTitle: 'نشاط الحروف', assessmentType: 'نشاط',
      score: 10, maxScore: 10, term: TERM, status: 'معتمد',
    },
  ];

  for (const g of grades) {
    await db.collection('gradeEntries').doc(g.id).set({
      ...g,
      academicYear: YEAR,
      createdAt: FieldValue.serverTimestamp(),
      decidedAt: g.status === 'معتمد' ? FieldValue.serverTimestamp() : null,
    }, { merge: true });
  }
}

async function seedAttendance() {
  console.log('→ Attendance…');
  const ahmad = FAMILY.children[0];
  const rows = [
    { date: isoDate(daysAgo(1)), classId: 'fam-class-ar', className: 'القراءة والتعبير', subject: 'لغة عربية', status: 'حاضر' },
    { date: isoDate(daysAgo(2)), classId: 'fam-class-ar', className: 'القراءة والتعبير', subject: 'لغة عربية', status: 'حاضر' },
    { date: isoDate(daysAgo(3)), classId: 'fam-class-math', className: 'الكسور والأعداد', subject: 'رياضيات', status: 'متأخر' },
    { date: isoDate(daysAgo(5)), classId: 'fam-class-ar', className: 'القراءة والتعبير', subject: 'لغة عربية', status: 'غائب' },
    { date: isoDate(daysAgo(1)), classId: 'fam-class-kg', className: 'أنشطة الروضة', subject: 'تهيئة', status: 'حاضر', studentId: 'fam-noor' },
  ];
  for (const r of rows) {
    const studentId = r.studentId || ahmad.id;
    const id = `${r.classId}_${r.date}`;
    await db.collection('students').doc(studentId).collection('attendanceRecords').doc(id).set({
      date: r.date,
      classId: r.classId,
      className: r.className,
      subject: r.subject,
      teacherId: TEACHER.id,
      teacherName: TEACHER.name,
      status: r.status,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
}

async function seedNotes() {
  console.log('→ Teacher notes…');
  const notes = [
    {
      studentId: 'fam-ahmad', id: 'note-1',
      kind: 'أكاديمي', sentiment: 'إيجابي',
      note: 'أحمد يشارك بفعالية ويقرأ بطلاقة متزايدة.',
      by: TEACHER.name, authorName: TEACHER.name,
      visibleToParent: true, visibleToStudent: true,
    },
    {
      studentId: 'fam-ahmad', id: 'note-2',
      kind: 'سلوكي', sentiment: 'محايد',
      note: 'يحتاج تنبيهاً خفيفاً للتركيز في نهاية الحصة.',
      by: 'أ. رنا عادل', authorName: 'أ. رنا عادل',
      visibleToParent: true, visibleToStudent: true,
    },
    {
      studentId: 'fam-noor', id: 'note-3',
      kind: 'اجتماعي', sentiment: 'إيجابي',
      note: 'نور تتعاون مع زميلاتها وتستمتع بالأنشطة.',
      by: 'أ. هدى مالك', authorName: 'أ. هدى مالك',
      visibleToParent: true, visibleToStudent: true,
    },
  ];
  for (const n of notes) {
    await db.collection('students').doc(n.studentId).collection('notes').doc(n.id).set({
      kind: n.kind,
      sentiment: n.sentiment,
      note: n.note,
      by: n.by,
      authorName: n.authorName,
      visibleToParent: n.visibleToParent,
      visibleToStudent: n.visibleToStudent,
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
}

async function seedFinance(parentUid) {
  console.log('→ Fees, discounts, installments, proofs, ledger…');
  const ahmad = FAMILY.children[0];
  const noor = FAMILY.children[1];

  await db.collection('charges').doc('fam-charge-ahmad-1').set({
    studentId: ahmad.id,
    student: ahmad.name,
    studentName: ahmad.name,
    stageLabel: ahmad.stageLabel,
    grade: ahmad.grade,
    classSection: ahmad.classSection,
    type: 'رسوم دراسية',
    amountMinorUnits: 40000,
    discountMinorUnits: 5000,
    status: 'مؤكَّد',
    method: 'تحويل',
    period: '2026-09',
    academicYear: YEAR,
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await db.collection('charges').doc('fam-charge-ahmad-2').set({
    studentId: ahmad.id,
    student: ahmad.name,
    studentName: ahmad.name,
    stageLabel: ahmad.stageLabel,
    type: 'رسوم دراسية',
    amountMinorUnits: 40000,
    discountMinorUnits: 0,
    status: 'متأخّر',
    method: '—',
    period: '2026-10',
    academicYear: YEAR,
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await db.collection('charges').doc('fam-charge-noor-1').set({
    studentId: noor.id,
    student: noor.name,
    studentName: noor.name,
    stageLabel: noor.stageLabel,
    type: 'رسوم دراسية',
    amountMinorUnits: 35000,
    discountMinorUnits: 0,
    status: 'مؤكَّد',
    method: 'نقد',
    period: '2026-09',
    academicYear: YEAR,
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await db.collection('studentDiscounts').doc('fam-disc-ahmad').set({
    studentId: ahmad.id,
    studentName: ahmad.name,
    amountMinorUnits: 5000,
    kind: 'sibling',
    kindLabel: 'خصم إخوة',
    mode: 'amount',
    reason: 'أخ/أخت في الروضة',
    academicYear: YEAR,
    status: 'مفعّل',
    createdByName: 'ليلى حسن',
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await db.collection('installmentPlans').doc('fam-plan-ahmad').set({
    studentId: ahmad.id,
    studentName: ahmad.name,
    totalMinorUnits: 60000,
    months: 3,
    installmentMinorUnits: 20000,
    startPeriod: '2026-09',
    status: 'نشط',
    notes: 'تقسيط رسوم الفصل الأول',
    academicYear: YEAR,
    paidCount: 1,
    createdByName: 'ليلى حسن',
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  const installments = [
    { id: 'fam-inst-1', index: 1, period: '2026-09', status: 'مدفوع' },
    { id: 'fam-inst-2', index: 2, period: '2026-10', status: 'مستحق' },
    { id: 'fam-inst-3', index: 3, period: '2026-11', status: 'مجدول' },
  ];
  for (const i of installments) {
    await db.collection('installments').doc(i.id).set({
      planId: 'fam-plan-ahmad',
      studentId: ahmad.id,
      studentName: ahmad.name,
      index: i.index,
      ofTotal: 3,
      amountMinorUnits: 20000,
      period: i.period,
      status: i.status,
      academicYear: YEAR,
    }, { merge: true });
  }

  const ledger = [
    { id: 'l1', date: '2026-09-01', item: 'رسوم دراسية — الفصل الأول', debitMinorUnits: 80000, creditMinorUnits: 0, balanceMinorUnits: 80000 },
    { id: 'l2', date: '2026-09-01', item: 'خصم إخوة', debitMinorUnits: 0, creditMinorUnits: 5000, balanceMinorUnits: 75000 },
    { id: 'l3', date: '2026-09-12', item: 'دفعة تحويل — قسط 1', debitMinorUnits: 0, creditMinorUnits: 20000, balanceMinorUnits: 55000 },
    { id: 'l4', date: '2026-10-01', item: 'رسوم أكتوبر', debitMinorUnits: 0, creditMinorUnits: 0, balanceMinorUnits: 25000 },
  ];
  for (const row of ledger) {
    await db.collection('students').doc(ahmad.id).collection('ledger').doc(row.id).set(row, { merge: true });
  }

  await db.collection('paymentProofs').doc('fam-proof-1').set({
    studentId: ahmad.id,
    studentName: ahmad.name,
    guardianUid: parentUid,
    guardianName: FAMILY.parent.name,
    amountMinorUnits: 20000,
    bankAccountName: 'مدرسة السليمانية — بنك فلسطين',
    payerName: FAMILY.parent.name,
    payerPhone: FAMILY.parent.phoneLocal,
    transferRef: 'FAM-TRX-1001',
    note: 'القسط الثاني',
    receiptUrl: 'https://example.com/receipt-demo.jpg',
    status: 'قيد المراجعة',
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function seedAbsence(parentUid) {
  console.log('→ Absence excuses…');
  const ahmad = FAMILY.children[0];
  await db.collection('absenceExcuses').doc('fam-excuse-1').set({
    studentId: ahmad.id,
    studentName: ahmad.name,
    guardianUid: parentUid,
    guardianName: FAMILY.parent.name,
    date: isoDate(daysAgo(5)),
    reason: 'مرض',
    note: 'ارتفاع حرارة — تقرير طبي مرفق عند الحاجة',
    status: 'قيد المراجعة',
    teacherIds: [TEACHER.id],
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await db.collection('absenceExcuses').doc('fam-excuse-2').set({
    studentId: ahmad.id,
    studentName: ahmad.name,
    guardianUid: parentUid,
    guardianName: FAMILY.parent.name,
    date: isoDate(daysAgo(12)),
    reason: 'ظرف عائلي',
    note: '',
    status: 'مقبول',
    teacherIds: [TEACHER.id],
    reviewedByName: 'أ. سمر النجار',
    createdAt: Timestamp.fromDate(daysAgo(11)),
    reviewedAt: Timestamp.fromDate(daysAgo(10)),
  }, { merge: true });
}

async function seedExams() {
  console.log('→ Approved class exams…');
  await db.collection('classExams').doc('fam-exam-ar').set({
    classId: 'fam-class-ar',
    className: 'القراءة والتعبير',
    subject: 'لغة عربية',
    teacherId: TEACHER.id,
    teacherName: TEACHER.name,
    title: 'اختبار الوحدة الثانية',
    examDate: isoDate((() => { const d = new Date(); d.setDate(d.getDate() + 7); return d; })()),
    startTime: '09:00',
    endTime: '10:00',
    notes: 'يُرجى إحضار الأقلام فقط',
    grade: 'الخامس الأساسي',
    term: TERM,
    academicYear: YEAR,
    status: 'معتمد',
    createdAt: FieldValue.serverTimestamp(),
    decidedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function seedAnnouncementsAndNotifications(parentUid, studentAuthById) {
  console.log('→ Announcements + notifications…');
  await db.collection('announcements').doc('fam-ann-1').set({
    title: 'بدء اختبارات الوحدة الثانية',
    body: 'تبدأ اختبارات الوحدة الأسبوع القادم. يُرجى متابعة الجدول من بوابة ولي الأمر.',
    audience: 'أولياء الأمور',
    status: 'منشور',
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await db.collection('announcements').doc('fam-ann-2').set({
    title: 'تذكير بالزي المدرسي',
    body: 'نذكّر بالتزام الزي الكامل يوم الأحد.',
    audience: 'الجميع',
    status: 'منشور',
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await db.collection('announcements').doc('fam-ann-3').set({
    title: 'نشاط الروضة الأسبوعي',
    body: 'فعالية تلوين يوم الخميس للروضة.',
    audience: 'الروضة',
    status: 'منشور',
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  const notifs = [
    {
      id: 'fam-n-parent-1',
      userId: parentUid,
      role: 'parent',
      type: 'grade_approved',
      title: 'درجة معتمدة — أحمد محمد السليماني',
      body: '«اختبار الوحدة الأولى» — 88/100 · لغة عربية',
      studentId: 'fam-ahmad',
      studentName: FAMILY.children[0].name,
      link: '/parent/grades',
    },
    {
      id: 'fam-n-parent-2',
      userId: parentUid,
      role: 'parent',
      type: 'exam_scheduled',
      title: 'اختبار: اختبار الوحدة الثانية',
      body: 'القراءة والتعبير — موعد قريب',
      classId: 'fam-class-ar',
      link: '/parent/exams',
    },
    {
      id: 'fam-n-stu-1',
      userId: studentAuthById['fam-ahmad'].uid,
      role: 'student',
      type: 'grade_approved',
      title: 'درجة جديدة معتمدة',
      body: '«اختبار الوحدة الأولى» — 88/100',
      studentId: 'fam-ahmad',
      link: '/student/grades',
    },
  ];
  for (const n of notifs) {
    await db.collection('notifications').doc(n.id).set({
      ...n,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
}

async function main() {
  await wipeFamilyDocs();
  await ensureSchoolCalendar();

  const parent = await createParent();
  const studentAuthById = {};
  for (const child of FAMILY.children) {
    studentAuthById[child.id] = await createStudentAuth(child);
  }

  await seedChildren(parent.uid, studentAuthById);
  const classes = await seedClassesAndEnrollments();
  await seedDayLogs(classes);
  await seedGrades();
  await seedAttendance();
  await seedNotes();
  await seedFinance(parent.uid);
  await seedAbsence(parent.uid);
  await seedExams();
  await seedAnnouncementsAndNotifications(parent.uid, studentAuthById);

  console.log('\n✅ عائلة تجريبية جاهزة في النظام\n');
  console.log('────────────────────────────────────────');
  console.log('ولي الأمر');
  console.log('  الدخول:   /login/parent');
  console.log('  الجوال:   %s', FAMILY.parent.phoneLocal);
  console.log('  الاسم:    %s', FAMILY.parent.name);
  console.log('  uid:      %s', parent.uid);
  console.log('');
  console.log('الأبناء');
  for (const c of FAMILY.children) {
    console.log('  %s', c.name);
    console.log('    الدخول:  /login/student');
    console.log('    الرقم:   %s  (أو %s)', c.displayId, c.displayId.replace('STU-', ''));
    console.log('    uid:     %s', studentAuthById[c.id].uid);
  }
  console.log('────────────────────────────────────────');
  console.log('ما يظهر في البوابة: درجات · حضور · ملاحظات · رسوم');
  console.log('  خصم/تقسيط · وصول دفع · تبرير غياب · واجبات');
  console.log('  اختبارات · إعلانات · تنبيهات');
  console.log('');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
