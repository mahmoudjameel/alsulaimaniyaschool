#!/usr/bin/env node
/**
 * Creates / updates the reception portal login only.
 * Usage: node scripts/ensure-reception.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { ROLE_DEFAULT_PERMISSIONS } from '../src/lib/permissions.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = join(__dirname, '..', 'serviceAccountKey.json');
const EMAIL = 'reception@sulaimaniya.ps';
const PASSWORD = 'Passw0rd!';
const NAME = 'سارة الاستقبال';
const TITLE = 'موظف استقبال وتسجيل';

initializeApp({
  credential: existsSync(keyPath) ? cert(JSON.parse(readFileSync(keyPath, 'utf8'))) : applicationDefault(),
});

const db = getFirestore();
const auth = getAuth();

async function main() {
  let user;
  try {
    user = await auth.getUserByEmail(EMAIL);
    await auth.updateUser(user.uid, { password: PASSWORD, displayName: NAME });
    console.log('Updated existing auth user:', EMAIL);
  } catch {
    user = await auth.createUser({ email: EMAIL, password: PASSWORD, displayName: NAME });
    console.log('Created auth user:', EMAIL);
  }

  await db.collection('users').doc(user.uid).set({
    role: 'reception',
    name: NAME,
    title: TITLE,
    email: EMAIL,
    permissions: ROLE_DEFAULT_PERMISSIONS.reception,
  }, { merge: true });

  await db.collection('staff').doc(user.uid).set({
    name: NAME,
    role: 'استقبال / تسجيل',
    jobTitleAr: TITLE,
    roleType: 'reception',
    salaryType: 'monthly',
    type: 'راتب شهري',
    monthlySalaryMinorUnits: 45000,
    baseMinorUnits: 45000,
    authUid: user.uid,
    active: true,
  }, { merge: true });

  console.log('\n✅ Reception account ready');
  console.log('   Login: /login/reception');
  console.log('   Email:', EMAIL);
  console.log('   Password:', PASSWORD);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
