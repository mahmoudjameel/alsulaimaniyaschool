import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

const db = () => getFirestore();
const auth = () => getAuth();
const storageBucket = () => getStorage().bucket();

/** Top-level collections + known subcollections for full school OS backup. */
export const BACKUP_SCHEMA = {
  users: [],
  admissions: [],
  students: ['ledger', 'documents', 'attendanceRecords', 'guardians', 'classes', 'notes'],
  charges: [],
  paymentProofs: [],
  payroll: [],
  staff: ['attendance'],
  disbursements: [],
  expenses: [],
  feeTemplates: [],
  studentDiscounts: [],
  installmentPlans: [],
  installments: [],
  absenceExcuses: [],
  classes: ['lessons', 'quizzes', 'enrollments', 'attendanceSessions'],
  gradeEntries: [],
  quizAttempts: [],
  teacherProfiles: [],
  academicStages: [],
  observations: [],
  activityLog: [],
  articles: [],
  announcements: [],
  comments: [],
  registrations: [],
  schoolSettings: [],
  staffAttendanceDays: [],
  notifications: [],
  staffRequests: [],
  classExams: [],
  homeworkSubmissions: [],
};

const WIPE_CONFIRM = 'مسح-كل-البيانات';
const BACKUP_VERSION = 1;

async function requireAdmin(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول.');
  const user = (await db().collection('users').doc(uid).get()).data();
  if (user?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'هذه العملية للإدارة فقط.');
  }
  return { uid, user };
}

function serializeValue(value) {
  if (value == null) return value;
  if (value instanceof Timestamp || (typeof value?.toDate === 'function' && value.seconds != null)) {
    try {
      return { __type: 'timestamp', iso: value.toDate().toISOString() };
    } catch {
      return null;
    }
  }
  if (typeof value?.latitude === 'number' && typeof value?.longitude === 'number') {
    return { __type: 'geo', lat: value.latitude, lng: value.longitude };
  }
  if (Array.isArray(value)) return value.map(serializeValue);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = serializeValue(v);
    return out;
  }
  return value;
}

function deserializeValue(value) {
  if (value == null) return value;
  if (value.__type === 'timestamp' && value.iso) {
    return Timestamp.fromDate(new Date(value.iso));
  }
  if (value.__type === 'geo') {
    return { latitude: value.lat, longitude: value.lng };
  }
  if (Array.isArray(value)) return value.map(deserializeValue);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = deserializeValue(v);
    return out;
  }
  return value;
}

async function readSubcollections(docRef, subNames) {
  const subs = {};
  for (const name of subNames) {
    const snap = await docRef.collection(name).get();
    const docs = {};
    snap.forEach((d) => {
      docs[d.id] = serializeValue(d.data());
    });
    if (Object.keys(docs).length) subs[name] = docs;
  }
  return subs;
}

async function exportCollection(name, subNames) {
  const snap = await db().collection(name).get();
  const docs = {};
  for (const d of snap.docs) {
    const entry = { data: serializeValue(d.data()) };
    if (subNames.length) {
      const subs = await readSubcollections(d.ref, subNames);
      if (Object.keys(subs).length) entry.subcollections = subs;
    }
    docs[d.id] = entry;
  }
  return docs;
}

async function listAllAuthUsers() {
  const users = [];
  let pageToken;
  do {
    const res = await auth().listUsers(1000, pageToken);
    for (const u of res.users) {
      users.push({
        uid: u.uid,
        email: u.email || null,
        displayName: u.displayName || null,
        disabled: !!u.disabled,
        phoneNumber: u.phoneNumber || null,
        emailVerified: !!u.emailVerified,
      });
    }
    pageToken = res.pageToken;
  } while (pageToken);
  return users;
}

function countBackup(collections) {
  const counts = {};
  let total = 0;
  for (const [name, docs] of Object.entries(collections || {})) {
    const n = Object.keys(docs || {}).length;
    counts[name] = n;
    total += n;
  }
  return { counts, totalDocs: total };
}

async function deleteQueryBatch(query, batchSize = 400) {
  const snap = await query.limit(batchSize).get();
  if (snap.empty) return 0;
  const batch = db().batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return snap.size;
}

async function deleteSubcollections(docRef, subNames) {
  for (const name of subNames) {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const n = await deleteQueryBatch(docRef.collection(name));
      if (!n) break;
    }
  }
}

async function wipeCollection(name, subNames) {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await db().collection(name).limit(200).get();
    if (snap.empty) break;
    for (const d of snap.docs) {
      if (subNames.length) await deleteSubcollections(d.ref, subNames);
    }
    const batch = db().batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

async function writeDocsBatched(writes) {
  const CHUNK = 400;
  for (let i = 0; i < writes.length; i += CHUNK) {
    const batch = db().batch();
    for (const w of writes.slice(i, i + CHUNK)) {
      batch.set(w.ref, w.data, { merge: false });
    }
    await batch.commit();
  }
}

const randomPassword = () => `Sc-${Math.random().toString(36).slice(2, 8)}${Math.floor(Math.random() * 90 + 10)}!`;

/**
 * Full system export: Firestore schema + Auth user metadata.
 * Passwords cannot be exported by Firebase — passwordsByEmail is empty for the admin to fill before import.
 */
export const exportSystemBackup = onCall(
  { cors: true, timeoutSeconds: 540, memory: '1GiB' },
  async (request) => {
    const { uid, user } = await requireAdmin(request);

    const collections = {};
    for (const [name, subs] of Object.entries(BACKUP_SCHEMA)) {
      collections[name] = await exportCollection(name, subs);
    }
    const authUsers = await listAllAuthUsers();
    const { counts, totalDocs } = countBackup(collections);

    const backup = {
      version: BACKUP_VERSION,
      kind: 'alsulaimaniya-system-backup',
      exportedAt: new Date().toISOString(),
      exportedBy: { uid, name: user?.name || null, email: user?.email || null },
      noteAr:
        'Firebase لا يصدّر كلمات المرور. قبل الاستيراد عبّئ passwordsByEmail أو حدّد defaultPassword في شاشة الاستيراد.',
      passwordsByEmail: {},
      authUsers,
      collections,
      meta: { counts, totalDocs, authUserCount: authUsers.length },
    };

    const json = JSON.stringify(backup);
    const bytes = Buffer.byteLength(json, 'utf8');
    const fileName = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

    // Prefer Storage for large payloads (callable response limit).
    if (bytes > 4.5 * 1024 * 1024) {
      const bkt = storageBucket();
      const path = `system-backups/${uid}/${fileName}`;
      const file = bkt.file(path);
      await file.save(json, { contentType: 'application/json', resumable: false });
      const [downloadUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 60 * 60 * 1000,
      });
      await db().collection('activityLog').add({
        type: 'system_backup_export',
        actorUid: uid,
        actorName: user?.name || '—',
        actorRole: 'admin',
        summary: `تصدير نسخة احتياطية (${totalDocs} مستند، ${authUsers.length} حساب)`,
        createdAt: FieldValue.serverTimestamp(),
      });
      return {
        mode: 'url',
        downloadUrl,
        fileName,
        meta: backup.meta,
        noteAr: backup.noteAr,
      };
    }

    await db().collection('activityLog').add({
      type: 'system_backup_export',
      actorUid: uid,
      actorName: user?.name || '—',
      actorRole: 'admin',
      summary: `تصدير نسخة احتياطية (${totalDocs} مستند، ${authUsers.length} حساب)`,
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      mode: 'inline',
      fileName,
      backup,
      meta: backup.meta,
      noteAr: backup.noteAr,
    };
  }
);

/**
 * Import a previously exported backup. Restores Firestore docs and recreates missing Auth users.
 * Passwords: passwordsByEmail map, else defaultPassword, else random (returned in report).
 */
export const importSystemBackup = onCall(
  { cors: true, timeoutSeconds: 540, memory: '1GiB' },
  async (request) => {
    const { uid, user } = await requireAdmin(request);
    const {
      backup: inlineBackup,
      storagePath,
      defaultPassword,
      wipeBeforeImport = false,
      confirmWipe,
    } = request.data || {};

    let backup = inlineBackup;
    if (!backup && storagePath) {
      if (!String(storagePath).startsWith(`system-backups/${uid}/`)) {
        throw new HttpsError('permission-denied', 'مسار النسخة غير مسموح.');
      }
      const [buf] = await storageBucket().file(storagePath).download();
      backup = JSON.parse(buf.toString('utf8'));
    }
    if (!backup || backup.kind !== 'alsulaimaniya-system-backup') {
      throw new HttpsError('invalid-argument', 'ملف النسخة الاحتياطية غير صالح.');
    }
    if (backup.version !== BACKUP_VERSION) {
      throw new HttpsError('failed-precondition', `إصدار النسخة غير مدعوم (${backup.version}).`);
    }

    if (wipeBeforeImport) {
      if (confirmWipe !== WIPE_CONFIRM) {
        throw new HttpsError('invalid-argument', `للتأكيد اكتب: ${WIPE_CONFIRM}`);
      }
      await wipeAllInternal(uid, user, { skipActivity: true });
    }

    const passwordsByEmail = {
      ...(backup.passwordsByEmail || {}),
    };
    const createdPasswords = [];
    const authReport = { created: 0, updated: 0, skipped: 0, errors: [] };

    // Restore Auth users first so UIDs can match when emails are recreated with same uid where possible.
    for (const au of backup.authUsers || []) {
      if (!au?.email && !au?.uid) continue;
      try {
        let existing = null;
        try {
          if (au.email) existing = await auth().getUserByEmail(au.email);
          else existing = await auth().getUser(au.uid);
        } catch {
          existing = null;
        }

        if (existing) {
          await auth().updateUser(existing.uid, {
            displayName: au.displayName || existing.displayName,
            disabled: !!au.disabled,
          });
          authReport.updated += 1;
        } else {
          const pwd =
            (au.email && passwordsByEmail[au.email]) ||
            (typeof defaultPassword === 'string' && defaultPassword.trim()) ||
            randomPassword();
          const createPayload = {
            uid: au.uid,
            email: au.email || undefined,
            displayName: au.displayName || undefined,
            disabled: !!au.disabled,
            password: pwd,
            emailVerified: !!au.emailVerified,
          };
          try {
            await auth().createUser(createPayload);
          } catch (err) {
            // UID may conflict if email changed — create without forcing uid
            delete createPayload.uid;
            await auth().createUser(createPayload);
          }
          authReport.created += 1;
          if (au.email) {
            createdPasswords.push({ email: au.email, password: pwd, displayName: au.displayName || null });
          }
        }
      } catch (err) {
        authReport.skipped += 1;
        authReport.errors.push({ email: au.email || au.uid, message: err.message });
      }
    }

    // Restore Firestore
    let restoredDocs = 0;
    for (const [colName, docs] of Object.entries(backup.collections || {})) {
      const writes = [];
      for (const [docId, entry] of Object.entries(docs || {})) {
        const data = deserializeValue(entry.data || {});
        writes.push({ ref: db().collection(colName).doc(docId), data });
        restoredDocs += 1;
        const subs = entry.subcollections || {};
        for (const [subName, subDocs] of Object.entries(subs)) {
          for (const [subId, subData] of Object.entries(subDocs || {})) {
            writes.push({
              ref: db().collection(colName).doc(docId).collection(subName).doc(subId),
              data: deserializeValue(subData),
            });
            restoredDocs += 1;
          }
        }
      }
      await writeDocsBatched(writes);
    }

    // Ensure current admin profile remains admin
    await db().collection('users').doc(uid).set({
      role: 'admin',
      name: user?.name || 'مدير',
      email: user?.email || null,
      permissions: user?.permissions || {},
      restoredAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    await db().collection('activityLog').add({
      type: 'system_backup_import',
      actorUid: uid,
      actorName: user?.name || '—',
      actorRole: 'admin',
      summary: `استيراد نسخة احتياطية (${restoredDocs} مستند)`,
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      ok: true,
      restoredDocs,
      authReport,
      createdPasswords,
      noteAr: createdPasswords.length
        ? 'حُفظت كلمات المرور الجديدة للحسابات المُعاد إنشاؤها — احفظها فوراً.'
        : 'تمت الاستعادة. لم تُنشأ حسابات دخول جديدة.',
    };
  }
);

async function wipeAllInternal(actorUid, actorUser, { skipActivity } = {}) {
  const adminSnap = await db().collection('users').doc(actorUid).get();
  const adminData = adminSnap.exists ? adminSnap.data() : {
    role: 'admin',
    name: actorUser?.name || 'مدير',
    email: actorUser?.email || null,
    permissions: {},
  };

  for (const [name, subs] of Object.entries(BACKUP_SCHEMA)) {
    await wipeCollection(name, subs);
  }

  // Delete auth users except current admin
  let pageToken;
  do {
    const res = await auth().listUsers(1000, pageToken);
    const toDelete = res.users.map((u) => u.uid).filter((id) => id !== actorUid);
    // deleteUsers accepts up to 1000
    for (let i = 0; i < toDelete.length; i += 100) {
      const chunk = toDelete.slice(i, i + 100);
      if (chunk.length) await auth().deleteUsers(chunk);
    }
    pageToken = res.pageToken;
  } while (pageToken);

  await db().collection('users').doc(actorUid).set({
    ...adminData,
    role: 'admin',
    wipedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  if (!skipActivity) {
    await db().collection('activityLog').add({
      type: 'system_wipe',
      actorUid,
      actorName: adminData.name || '—',
      actorRole: 'admin',
      summary: 'مسح كل بيانات النظام مع الإبقاء على حساب الإدارة الحالي',
      createdAt: FieldValue.serverTimestamp(),
    });
  }
}

export const wipeSystemData = onCall(
  { cors: true, timeoutSeconds: 540, memory: '1GiB' },
  async (request) => {
    const { uid, user } = await requireAdmin(request);
    const { confirm } = request.data || {};
    if (confirm !== WIPE_CONFIRM) {
      throw new HttpsError('invalid-argument', `للتأكيد اكتب بالضبط: ${WIPE_CONFIRM}`);
    }
    await wipeAllInternal(uid, user);
    return {
      ok: true,
      keptAdminUid: uid,
      noteAr: 'تم مسح البيانات. حسابك الإداري ما زال فعّالاً. ابدأ بإضافة البيانات الحقيقية.',
    };
  }
);

export { WIPE_CONFIRM };
