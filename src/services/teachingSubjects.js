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

/** Normalize teacher profile → subject id list (supports legacy single subjectId). */
export function teacherSubjectIds(teacher) {
  if (!teacher) return [];
  if (Array.isArray(teacher.subjectIds) && teacher.subjectIds.length) {
    return [...new Set(teacher.subjectIds.filter(Boolean))];
  }
  if (teacher.subjectId) return [teacher.subjectId];
  return [];
}

export function teacherSubjectLabels(teacher, subjectsById) {
  const ids = teacherSubjectIds(teacher);
  if (ids.length && subjectsById) {
    const labels = ids.map((id) => subjectsById.get(id)?.labelAr).filter(Boolean);
    if (labels.length) return labels.join(' · ');
  }
  return teacher?.subject || '—';
}

/** Teachers linked to this subject; falls back to full list if none linked. */
export function teachersForSubjectLabel(allTeachers, subjects, subjectLabel) {
  const sub = findSubjectByLabel(subjects, subjectLabel);
  if (!sub) return allTeachers || [];
  const ids = new Set(sub.teacherIds || []);
  // Also include teachers who list this subject on their profile (multi-subject).
  for (const t of allTeachers || []) {
    if (teacherSubjectIds(t).includes(sub.id)) ids.add(t.id);
  }
  if (!ids.size) return allTeachers || [];
  const filtered = (allTeachers || []).filter((t) => ids.has(t.id));
  return filtered.length ? filtered : (allTeachers || []);
}

function normalizeSubjectKey(s) {
  return String(s || '')
    .replace(/^ال/g, '')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();
}

async function subjectLabelMap() {
  const snap = await getDocs(subjectsQuery());
  return new Map(snap.docs.map((d) => [d.id, d.data().labelAr || '—']));
}

function profileSubjectIds(data = {}) {
  if (Array.isArray(data.subjectIds) && data.subjectIds.length) {
    return [...new Set(data.subjectIds.filter(Boolean))];
  }
  if (data.subjectId) return [data.subjectId];
  return [];
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

/** Add teacher to one subject without removing other subjects they teach. */
export async function linkTeacherToSubject(teacherId, subjectId) {
  if (!teacherId || !subjectId) return;
  const labelById = await subjectLabelMap();
  const tSnap = await getDoc(doc(db, 'teacherProfiles', teacherId));
  const ids = profileSubjectIds(tSnap.data());
  if (!ids.includes(subjectId)) ids.push(subjectId);

  const batch = writeBatch(db);
  batch.update(doc(db, 'teachingSubjects', subjectId), {
    teacherIds: arrayUnion(teacherId),
    updatedAt: serverTimestamp(),
  });
  const labels = ids.map((id) => labelById.get(id)).filter(Boolean);
  batch.update(doc(db, 'teacherProfiles', teacherId), {
    subjectIds: ids,
    subjectId: ids[0] || null,
    subject: labels.join(' · ') || '—',
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

/** Link many subjects to one teacher (replaces teacher's subject list). */
export async function setTeacherSubjects(teacherId, subjectIds) {
  if (!teacherId) return;
  const nextIds = [...new Set((subjectIds || []).filter(Boolean))];
  const labelById = await subjectLabelMap();
  const labels = nextIds.map((id) => labelById.get(id)).filter(Boolean);

  const batch = writeBatch(db);
  batch.update(doc(db, 'teacherProfiles', teacherId), {
    subjectIds: nextIds,
    subjectId: nextIds[0] || null,
    subject: labels.length ? labels.join(' · ') : '—',
    updatedAt: serverTimestamp(),
  });

  const allSubjects = await getDocs(subjectsQuery());
  for (const sDoc of allSubjects.docs) {
    const sid = sDoc.id;
    const current = sDoc.data().teacherIds || [];
    const should = nextIds.includes(sid);
    const has = current.includes(teacherId);
    if (should && !has) {
      batch.update(sDoc.ref, { teacherIds: arrayUnion(teacherId), updatedAt: serverTimestamp() });
    } else if (!should && has) {
      batch.update(sDoc.ref, { teacherIds: arrayRemove(teacherId), updatedAt: serverTimestamp() });
    }
  }
  await batch.commit();
}

/** Replace teachers on one subject; each teacher keeps other subjects they teach. */
export async function setSubjectTeachers(subjectId, teacherIds) {
  const subjectRef = doc(db, 'teachingSubjects', subjectId);
  const subjectSnap = await getDoc(subjectRef);
  if (!subjectSnap.exists()) throw new Error('subject not found');

  const prevIds = subjectSnap.data().teacherIds || [];
  const nextIds = [...new Set((teacherIds || []).filter(Boolean))];
  const removed = prevIds.filter((id) => !nextIds.includes(id));
  const added = nextIds.filter((id) => !prevIds.includes(id));
  const affected = [...new Set([...removed, ...added])];
  const labelById = await subjectLabelMap();

  const batch = writeBatch(db);
  batch.update(subjectRef, { teacherIds: nextIds, updatedAt: serverTimestamp() });

  for (const tid of affected) {
    const tSnap = await getDoc(doc(db, 'teacherProfiles', tid));
    let ids = profileSubjectIds(tSnap.data());
    if (added.includes(tid) && !ids.includes(subjectId)) ids.push(subjectId);
    if (removed.includes(tid)) ids = ids.filter((id) => id !== subjectId);
    const labels = ids.map((id) => labelById.get(id)).filter(Boolean);
    batch.update(doc(db, 'teacherProfiles', tid), {
      subjectIds: ids,
      subjectId: ids[0] || null,
      subject: labels.length ? labels.join(' · ') : '—',
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

/** @deprecated use linkTeacherToSubject — kept for imports */
export async function assignTeacherSubject(teacherId, subjectId) {
  return linkTeacherToSubject(teacherId, subjectId);
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
      await linkTeacherToSubject(tDoc.id, match.ref.id);
      linked += 1;
    }
  }
  return { created: created.length, linked };
}
