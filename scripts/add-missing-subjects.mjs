#!/usr/bin/env node
/**
 * Adds missing default teaching subjects to Firestore (burouto / live project).
 * Usage: node scripts/add-missing-subjects.mjs
 * Requires serviceAccountKey.json or GOOGLE_APPLICATION_CREDENTIALS.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const DEFAULT_TEACHING_SUBJECTS = [
  { labelAr: 'اللغة العربية', shortLabel: 'لغة عربية', order: 0 },
  { labelAr: 'الرياضيات', shortLabel: 'رياضيات', order: 1 },
  { labelAr: 'العلوم', shortLabel: 'علوم', order: 2 },
  { labelAr: 'اللغة الإنجليزية', shortLabel: 'إنجليزي', order: 3 },
  { labelAr: 'التربية الدينية', shortLabel: 'تربية دينية', order: 4 },
  { labelAr: 'تاريخ وجغرافيا', shortLabel: 'تاريخ وجغرافيا', order: 5 },
  { labelAr: 'ثقافة', shortLabel: 'ثقافة', order: 6 },
  { labelAr: 'تكنولوجيا', shortLabel: 'تكنولوجيا', order: 7 },
  { labelAr: 'رياضة', shortLabel: 'رياضة', order: 8 },
  { labelAr: 'فنون وحرف', shortLabel: 'فنون وحرف', order: 9 },
];

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = join(__dirname, '..', 'serviceAccountKey.json');

initializeApp({
  credential: existsSync(keyPath) ? cert(JSON.parse(readFileSync(keyPath, 'utf8'))) : applicationDefault(),
});

const db = getFirestore();

const SUBJECT_LABEL_ALIASES = {
  'التربية الدينية': ['التربية الإسلامية', 'تربية إسلامية'],
  'تكنولوجيا': ['الحاسوب والتقنية', 'حاسوب'],
  'رياضة': ['التربية الرياضية', 'تربية رياضية'],
  'فنون وحرف': ['الفنون', 'فنون'],
};

function normalizeSubjectKey(s) {
  return String(s || '')
    .replace(/^ال/g, '')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();
}

function subjectAlreadyExists(existingDocs, meta) {
  const keys = new Set([
    normalizeSubjectKey(meta.labelAr),
    normalizeSubjectKey(meta.shortLabel),
    ...(SUBJECT_LABEL_ALIASES[meta.labelAr] || []).map(normalizeSubjectKey),
  ]);
  return existingDocs.some((d) => {
    const data = d.data();
    const labels = [data.labelAr, data.shortLabel].map(normalizeSubjectKey);
    return labels.some((l) => keys.has(l) || [...keys].some((k) => k && l && (k.includes(l) || l.includes(k))));
  });
}

async function main() {
  const snap = await db.collection('teachingSubjects').orderBy('order', 'asc').get();
  const docs = snap.docs;
  let maxOrder = docs.reduce((m, d) => Math.max(m, d.data().order ?? 0), -1);
  const batch = db.batch();
  const added = [];

  for (const meta of DEFAULT_TEACHING_SUBJECTS) {
    if (subjectAlreadyExists(docs, meta)) {
      console.log('  ✓ موجود:', meta.labelAr);
      continue;
    }
    maxOrder += 1;
    const ref = db.collection('teachingSubjects').doc();
    batch.set(ref, {
      labelAr: meta.labelAr,
      shortLabel: meta.shortLabel,
      teacherIds: [],
      order: maxOrder,
      active: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    added.push(meta.labelAr);
    console.log('  + إضافة:', meta.labelAr);
  }

  if (!added.length) {
    console.log('\n✅ كل المواد موجودة — لا شيء لإضافته.');
    process.exit(0);
  }

  await batch.commit();
  console.log(`\n✅ أُضيفت ${added.length} مواد: ${added.join('، ')}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
