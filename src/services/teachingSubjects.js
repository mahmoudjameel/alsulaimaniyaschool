import {
  addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs,
  orderBy, query, serverTimestamp, updateDoc, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config';

export const subjectsCol = collection(db, 'teachingSubjects');
export const subjectsQuery = () => query(subjectsCol, orderBy('order', 'asc'));

/** Demo + seed defaults — stable ids in demo mode. */
export const DEFAULT_TEACHING_SUBJECTS = [
  { id: 'ts-ar', labelAr: 'اللغة العربية', shortLabel: 'لغة عربية', teacherIds: [], order: 0, active: true },
  { id: 'ts-math', labelAr: 'الرياضيات', shortLabel: 'رياضيات', teacherIds: [], order: 1, active: true },
  { id: 'ts-sci', labelAr: 'العلوم', shortLabel: 'علوم', teacherIds: [], order: 2, active: true },
  { id: 'ts-en', labelAr: 'اللغة الإنجليزية', shortLabel: 'إنجليزي', teacherIds: [], order: 3, active: true },
  { id: 'ts-islam', labelAr: 'التربية الإسلامية', shortLabel: 'تربية إسلامية', teacherIds: [], order: 4, active: true },
  { id: 'ts-art', labelAr: 'الفنون', shortLabel: 'فنون', teacherIds: [], order: 5, active: true },
  { id: 'ts-it', labelAr: 'الحاسوب والتقنية', shortLabel: 'حاسوب', teacherIds: [], order: 6, active: true },
  { id: 'ts-pe', labelAr: 'التربية الرياضية', shortLabel: 'تربية رياضية', teacherIds: [], order: 7, active: true },
];

export function subjectScheduleLabel(subject) {
  return subject?.shortLabel || subject?.labelAr || '';
}

export function findSubjectByLabel(subjects, label) {
  const raw = String(label || '').trim();
  if (!raw) return null;
  return (subjects || []).find(
    (s) => s.labelAr === raw || s.shortLabel === raw || subjectScheduleLabel(s) === raw,
  ) || null;
}

/** Teachers linked to this subject label; falls back to full list if none linked. */
export function teachersForSubjectLabel(allTeachers, subjects, subjectLabel) {
  const sub = findSubjectByLabel(subjects, subjectLabel);
  const ids = sub?.teacherIds || [];
  if (!ids.length) return allTeachers || [];
  const set = new Set(ids);
  const filtered = (allTeachers || []).filter((t) => set.has(t.id));
  return filtered.length ? filtered : (allTeachers || []);
}

function normalizeSubjectKey(s) {
  return String(s || '')
    .replace(/^ال/g, '')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();
}

export async function createTeachingSubject({ labelAr, shortLabel, order }) {
  const ref = await addDoc(subjectsCol, {
    labelAr: (labelAr || '').trim(),
    shortLabel: (shortLabel || labelAr || '').trim(),
    teacherIds: [],
    order: typeof order === 'number' ? order : 99,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateTeachingSubject(id, patch) {
  await updateDoc(doc(db, 'teachingSubjects', id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTeachingSubject(id) {
  await deleteDoc(doc(db, 'teachingSubjects', id));
}

/** Link one teacher as primary subject; updates subject.teacherIds + teacher profile. */
export async function assignTeacherSubject(teacherId, subjectId, { previousSubjectId } = {}) {
  if (!teacherId || !subjectId) return;
  const subjectSnap = await getDoc(doc(db, 'teachingSubjects', subjectId));
  if (!subjectSnap.exists()) return;
  const label = subjectSnap.data().labelAr || '—';

  const batch = writeBatch(db);
  if (previousSubjectId && previousSubjectId !== subjectId) {
    batch.update(doc(db, 'teachingSubjects', previousSubjectId), {
      teacherIds: arrayRemove(teacherId),
      updatedAt: serverTimestamp(),
    });
  }
  batch.update(doc(db, 'teachingSubjects', subjectId), {
    teacherIds: arrayUnion(teacherId),
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'teacherProfiles', teacherId), {
    subjectId,
    subject: label,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  await batch.commit();
}

/** Replace full teacher list on a subject and sync teacher profiles. */
export async function setSubjectTeachers(subjectId, teacherIds) {
  const subjectRef = doc(db, 'teachingSubjects', subjectId);
  const subjectSnap = await getDoc(subjectRef);
  if (!subjectSnap.exists()) throw new Error('subject not found');
  const label = subjectSnap.data().labelAr || '—';
  const prevIds = subjectSnap.data().teacherIds || [];
  const nextIds = [...new Set((teacherIds || []).filter(Boolean))];

  const batch = writeBatch(db);
  batch.update(subjectRef, { teacherIds: nextIds, updatedAt: serverTimestamp() });

  for (const tid of prevIds) {
    if (!nextIds.includes(tid)) {
      const tSnap = await getDoc(doc(db, 'teacherProfiles', tid));
      if (tSnap.exists() && tSnap.data().subjectId === subjectId) {
        batch.update(doc(db, 'teacherProfiles', tid), {
          subjectId: null,
          subject: '—',
          updatedAt: serverTimestamp(),
        });
      }
    }
  }
  for (const tid of nextIds) {
    batch.update(doc(db, 'teacherProfiles', tid), {
      subjectId,
      subject: label,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }
  await batch.commit();
}

export async function seedDefaultTeachingSubjects() {
  const existing = await getDocs(subjectsQuery());
  if (!existing.empty) return { created: 0, linked: 0 };

  const created = [];
  const batch = writeBatch(db);
  DEFAULT_TEACHING_SUBJECTS.forEach((s, i) => {
    const ref = doc(subjectsCol);
    created.push({ ref, meta: s });
    batch.set(ref, {
      labelAr: s.labelAr,
      shortLabel: s.shortLabel,
      teacherIds: [],
      order: i,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();

  let linked = 0;
  const teachersSnap = await getDocs(collection(db, 'teacherProfiles'));
  for (const tDoc of teachersSnap.docs) {
    const tKey = normalizeSubjectKey(tDoc.data().subject);
    if (!tKey) continue;
    const match = created.find(({ meta }) => {
      const a = normalizeSubjectKey(meta.labelAr);
      const b = normalizeSubjectKey(meta.shortLabel);
      return tKey === a || tKey === b || tKey.includes(a) || a.includes(tKey);
    });
    if (match) {
      await assignTeacherSubject(tDoc.id, match.ref.id);
      linked += 1;
    }
  }
  return { created: created.length, linked };
}
