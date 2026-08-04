#!/usr/bin/env node
/**
 * Seeds a connected Firebase project with the same illustrative data the
 * app shows in demo mode, plus one ready-to-use login per role.
 *
 * Usage:
 *   1. Fill in .env.local / .firebaserc with your real project.
 *   2. Download a service-account key (Firebase console → Project settings
 *      → Service accounts → Generate new private key) and either:
 *        export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
 *      or place it at ./serviceAccountKey.json (gitignored).
 *   3. node scripts/seed.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import {
  demoAdmissions, demoStudents, demoStudentDetail, demoBilling, demoPayroll,
  demoExpenses, demoClasses, demoArticles, demoAnnouncements, demoComments, demoEnrollments,
  demoGradeEntries, demoActivityLog, demoTeacherProfiles, demoAttendanceRecords, demoAttendanceSessions,
} from '../src/data/demo.js';
import { ROLE_DEFAULT_PERMISSIONS } from '../src/lib/permissions.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = join(__dirname, '..', 'serviceAccountKey.json');

initializeApp({
  credential: existsSync(keyPath) ? cert(JSON.parse(readFileSync(keyPath, 'utf8'))) : applicationDefault(),
});

const db = getFirestore();
const auth = getAuth();
const DEMO_PASSWORD = 'Passw0rd!';

/** "₪ 1٬200" / "− ₪ 60" / "—" → minor units (agorot). Demo data stores
 * pre-formatted display strings; the seed needs the real integer amount. */
function parseMoney(str) {
  if (!str || str === '—') return 0;
  const negative = str.includes('−') || str.includes('-');
  const digits = str.replace(/[^\d]/g, '');
  const shekels = digits ? parseInt(digits, 10) : 0;
  return (negative ? -shekels : shekels) * 100;
}

async function upsertAuthUser(email, displayName) {
  try {
    return await auth.getUserByEmail(email);
  } catch {
    return auth.createUser({ email, password: DEMO_PASSWORD, displayName });
  }
}

async function seedAccounts() {
  console.log('→ Creating demo login accounts…');
  const admin = await upsertAuthUser('admin@sulaimaniya.ps', 'فاطمة (المالكة)');
  const teacher = await upsertAuthUser('teacher@sulaimaniya.ps', 'أ. خالد الأحمد');
  const accountant = await upsertAuthUser('accountant@sulaimaniya.ps', 'ليلى حسن');
  const reception = await upsertAuthUser('reception@sulaimaniya.ps', 'سارة الاستقبال');
  const parent = await upsertAuthUser('parent@sulaimaniya.ps', 'خالد الأحمد');
  const student = await upsertAuthUser('stu-1042@students.sulaimaniya.local', 'يوسف الأحمد');

  await db.collection('users').doc(admin.uid).set({ role: 'admin', name: 'فاطمة (المالكة)', title: 'مدير عام', permissions: ROLE_DEFAULT_PERMISSIONS.admin });
  await db.collection('users').doc(teacher.uid).set({ role: 'teacher', name: 'أ. خالد الأحمد', title: 'معلّم لغة عربية', permissions: ROLE_DEFAULT_PERMISSIONS.teacher });
  await db.collection('users').doc(accountant.uid).set({ role: 'accountant', name: 'ليلى حسن', title: 'مسؤولة مالية', permissions: ROLE_DEFAULT_PERMISSIONS.accountant });
  await db.collection('users').doc(reception.uid).set({
    role: 'reception', name: 'سارة الاستقبال', title: 'موظف استقبال وتسجيل',
    email: 'reception@sulaimaniya.ps', permissions: ROLE_DEFAULT_PERMISSIONS.reception,
  });
  await db.collection('staff').doc(reception.uid).set({
    name: 'سارة الاستقبال',
    role: 'استقبال / تسجيل',
    jobTitleAr: 'موظف استقبال وتسجيل',
    roleType: 'reception',
    salaryType: 'monthly',
    type: 'راتب شهري',
    monthlySalaryMinorUnits: 45000,
    baseMinorUnits: 45000,
    authUid: reception.uid,
    active: true,
  }, { merge: true });
  await db.collection('users').doc(parent.uid).set({
    role: 'parent', name: 'خالد الأحمد', title: 'ولي أمر',
    phoneKey: '599812004', phoneLocal: '0599812004', phoneE164: '+970599812004', phoneDial: '970',
  });
  await db.collection('users').doc(student.uid).set({ role: 'student', name: 'يوسف الأحمد', displayId: 'STU-1042', studentId: 's1' });

  return { admin, teacher, accountant, reception, parent, student };
}

async function seedStudents({ parent, student }) {
  console.log('→ Seeding students…');
  for (const s of demoStudents) {
    const isYousef = s.id === 's1';
    await db.collection('students').doc(s.id).set({
      name: s.name, displayId: s.displayId, guardianName: s.guardianName, grade: s.grade,
      shift: s.shift, status: s.status, balanceMinorUnits: s.balanceMinorUnits, initial: s.initial,
      guardianUid: isYousef ? parent.uid : null,
      studentUid: isYousef ? student.uid : null,
      ...(isYousef ? {
        guardianPhoneLocal: '0599812004',
        guardianPhoneDial: '970',
        guardianPhoneE164: '+970599812004',
        guardianPhoneWa: '970599812004',
        guardianPhoneKey: '599812004',
        guardianPhone: '+970599812004',
      } : {}),
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    const detail = demoStudentDetail[s.id];
    if (!detail) continue;
    for (const l of detail.ledger || []) await db.collection('students').doc(s.id).collection('ledger').add(l);
    for (const d of detail.documents || []) await db.collection('students').doc(s.id).collection('documents').add(d);
    for (const g of detail.guardians || []) await db.collection('students').doc(s.id).collection('guardians').add({ ...g, createdAt: FieldValue.serverTimestamp() });
    for (const c of detail.classes || []) await db.collection('students').doc(s.id).collection('classes').add({ ...c, createdAt: FieldValue.serverTimestamp() });
    for (const n of detail.notes || []) {
      await db.collection('students').doc(s.id).collection('notes').add({
        kind: n.kind, sentiment: n.sentiment, note: n.note, by: n.by, createdAt: FieldValue.serverTimestamp(),
      });
    }
  }
}

async function seedAdmissions() {
  console.log('→ Seeding admissions…');
  for (const a of demoAdmissions) {
    await db.collection('admissions').doc(a.id).set({
      name: a.name, guardian: a.guardian, grade: a.grade, phone: a.phone, source: a.source,
      status: a.status, duplicateWarning: !!a.duplicateWarning, createdAt: FieldValue.serverTimestamp(),
    });
  }
}

async function seedBillingPayrollExpenses() {
  console.log('→ Seeding billing, payroll, and expenses…');
  const period = '2026-10';
  for (const [i, c] of demoBilling.charges.entries()) {
    await db.collection('charges').doc(`demo-charge-${i}`).set({
      student: c.student, type: c.type, amountMinorUnits: parseMoney(c.amount),
      discountMinorUnits: Math.abs(parseMoney(c.discount)),
      status: c.status, method: c.method, period, createdAt: FieldValue.serverTimestamp(),
    });
  }

  const staffSeed = [
    { id: 'staff-khaled', name: 'خالد الأحمد', role: 'معلّم لغة عربية', type: 'راتب شهري', baseMinorUnits: 62000 },
    { id: 'staff-layla', name: 'ليلى حسن', role: 'مسؤولة مالية', type: 'راتب شهري', baseMinorUnits: 72000 },
    { id: 'staff-ahmad', name: 'أحمد سعيد', role: 'سكرتارية', type: 'راتب شهري', baseMinorUnits: 48000 },
    { id: 'staff-rana', name: 'رنا عادل', role: 'معلّمة رياضيات', type: 'راتب يومي', baseMinorUnits: 3000 },
    { id: 'staff-samir', name: 'سمير فؤاد', role: 'مشرف', type: 'راتب شهري', baseMinorUnits: 55000 },
    { id: 'staff-huda', name: 'هدى مالك', role: 'معلّمة روضة', type: 'راتب شهري', baseMinorUnits: 50000 },
  ];
  for (const s of staffSeed) {
    await db.collection('staff').doc(s.id).set(s);
    await db.collection('staff').doc(s.id).collection('attendance').doc(period).set({ daysPresent: 22, workingDays: 22 });
  }
  for (const [i, p] of demoPayroll.entries()) {
    await db.collection('payroll').doc(`demo-payroll-${i}`).set({ ...p, period, updatedAt: FieldValue.serverTimestamp() });
  }
  for (const [i, x] of demoExpenses.entries()) {
    await db.collection('expenses').doc(`demo-expense-${i}`).set({
      date: x.date, vendor: x.vendor, category: x.category, amountMinorUnits: parseMoney(x.amount),
      status: x.status, createdAt: FieldValue.serverTimestamp(),
    });
  }
  await db.collection('feeTemplates').doc('الخامس الأساسي').set({ tuitionMinorUnits: 40000 });
}

// The one real teacher account (خالد) uses demo id 't-khaled' everywhere in
// demo.js; map it to their actual Firebase Auth uid so the class ↔ teacher
// ↔ grade links all resolve to the same real account once seeded.
function resolveTeacherId(id, accounts) {
  return id === 't-khaled' ? accounts.teacher.uid : id;
}

async function seedTeacherProfiles(accounts) {
  console.log('→ Seeding teacher directory…');
  for (const t of demoTeacherProfiles) {
    await db.collection('teacherProfiles').doc(resolveTeacherId(t.id, accounts)).set({
      name: t.name, subject: t.subject, bio: t.bio, email: t.email, phone: t.phone, initial: t.initial,
    });
  }
}

async function seedClassesAndContent(accounts) {
  console.log('→ Seeding classes, enrollments, and site content…');
  for (const c of demoClasses) {
    const teacherId = resolveTeacherId(c.teacherId, accounts);
    await db.collection('classes').doc(c.id).set({
      subject: c.subject, title: c.title, teacher: c.teacher, teacherId, grade: c.grade || '',
      shift: c.shift || 'صباحي', schedule: c.schedule || [], lessonsCount: c.lessons,
      studentsCount: c.students, visibility: c.visibility, createdAt: FieldValue.serverTimestamp(),
    });
    for (const e of demoEnrollments[c.id] || []) {
      await db.collection('classes').doc(c.id).collection('enrollments').doc(e.studentId).set({
        studentId: e.studentId, studentName: e.studentName, displayId: e.displayId, grade: e.grade,
        enrolledAt: FieldValue.serverTimestamp(),
      });
      await db.collection('students').doc(e.studentId).collection('classes').doc(c.id).set({
        subject: c.subject, title: c.title, teacher: c.teacher, teacherId, shift: c.shift || null,
        grade: '—', createdAt: FieldValue.serverTimestamp(),
      });
    }
  }
  for (const [i, a] of demoArticles.entries()) {
    await db.collection('articles').doc(`demo-article-${i}`).set({ ...a, createdAt: FieldValue.serverTimestamp() });
  }
  for (const [i, a] of demoAnnouncements.entries()) {
    await db.collection('announcements').doc(`demo-ann-${i}`).set({ ...a, createdAt: FieldValue.serverTimestamp() });
  }
  for (const [i, c] of demoComments.entries()) {
    await db.collection('comments').doc(`demo-comment-${i}`).set({ ...c, createdAt: FieldValue.serverTimestamp() });
  }
}

async function seedAttendance(accounts) {
  console.log('→ Seeding attendance…');
  const classById = Object.fromEntries(demoClasses.map((c) => [c.id, c]));

  for (const [classId, sessions] of Object.entries(demoAttendanceSessions)) {
    const cls = classById[classId];
    if (!cls) continue;
    const teacherId = resolveTeacherId(cls.teacherId, accounts);
    for (const s of sessions) {
      await db.collection('classes').doc(classId).collection('attendanceSessions').doc(s.date).set({
        date: s.date, classId, className: cls.title, subject: cls.subject, teacherId, teacherName: cls.teacher,
        shift: cls.shift || null, records: s.records, takenByName: s.takenByName, updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }

  for (const [studentId, records] of Object.entries(demoAttendanceRecords)) {
    for (const r of records) {
      const cls = classById[r.classId];
      const teacherId = cls ? resolveTeacherId(cls.teacherId, accounts) : null;
      await db.collection('students').doc(studentId).collection('attendanceRecords').doc(`${r.classId}_${r.date}`).set({
        date: r.date, classId: r.classId, className: r.className, subject: r.subject,
        teacherId, teacherName: cls?.teacher || null, status: r.status, updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }
}

async function seedGradesAndActivity(accounts) {
  console.log('→ Seeding grade entries and activity log…');
  for (const g of demoGradeEntries) {
    await db.collection('gradeEntries').doc(g.id).set({
      studentId: g.studentId, studentName: g.studentName, classId: g.classId, className: g.className,
      subject: g.subject, teacherId: resolveTeacherId(g.teacherId, accounts),
      teacherName: g.teacherName, assessmentTitle: g.assessmentTitle, score: g.score, maxScore: g.maxScore,
      status: g.status, createdAt: FieldValue.serverTimestamp(),
    });
  }
  for (const a of demoActivityLog) {
    await db.collection('activityLog').add({
      type: a.type, actorUid: accounts.admin.uid, actorName: a.actorName, actorRole: a.actorRole,
      summary: a.summary, targetType: null, targetId: null, createdAt: FieldValue.serverTimestamp(),
    });
  }
}

async function main() {
  const accounts = await seedAccounts();
  await seedStudents(accounts);
  await seedAdmissions();
  await seedBillingPayrollExpenses();
  await seedTeacherProfiles(accounts);
  await seedClassesAndContent(accounts);
  await seedAttendance(accounts);
  await seedGradesAndActivity(accounts);

  console.log('\n✅ Seed complete.');
  console.log('   Staff password: %s', DEMO_PASSWORD);
  console.log('   admin      → admin@sulaimaniya.ps (+ password)');
  console.log('   teacher    → teacher@sulaimaniya.ps (+ password)');
  console.log('   accountant → accountant@sulaimaniya.ps (+ password)');
  console.log('   reception  → reception@sulaimaniya.ps (+ password)');
  console.log('   parent     → phone 0599812004 (no password)');
  console.log('   student    → STU-1042 (no password)');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
