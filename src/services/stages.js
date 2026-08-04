import {
  addDoc, collection, deleteDoc, doc, orderBy, query, serverTimestamp, updateDoc, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { GRADE_OPTIONS, shekelsToMinorUnits } from '../lib/constants';

export const stagesCol = collection(db, 'academicStages');
export const stagesQuery = () => query(stagesCol, orderBy('order', 'asc'));

/** Default stages used for demo mode and first-time seed. */
export const DEFAULT_ACADEMIC_STAGES = GRADE_OPTIONS.map((labelAr, order) => ({
  id: `stage-${order}`,
  labelAr,
  order,
  active: true,
  category: order <= 1 ? 'preschool' : 'primary',
  ageRange: order === 0 ? '3–4 سنوات' : order === 1 ? '4–5 سنوات' : `${5 + order}–${6 + order} سنوات`,
  monthlyTuitionMinorUnits: [25000, 28000, 35000, 35000, 38000, 40000, 40000, 42000][order] ?? 40000,
}));

export async function createStage({ labelAr, category, ageRange, order, monthlyTuitionShekels }) {
  const ref = await addDoc(stagesCol, {
    labelAr: (labelAr || '').trim(),
    category: category || 'primary',
    ageRange: ageRange || '',
    order: typeof order === 'number' ? order : 99,
    monthlyTuitionMinorUnits: monthlyTuitionShekels != null && monthlyTuitionShekels !== ''
      ? shekelsToMinorUnits(monthlyTuitionShekels)
      : null,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateStage(stageId, patch) {
  await updateDoc(doc(db, 'academicStages', stageId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteStage(stageId) {
  await deleteDoc(doc(db, 'academicStages', stageId));
}

export async function seedDefaultStages() {
  const defaultFees = [250, 280, 350, 350, 380, 400, 400, 420];
  const batch = writeBatch(db);
  DEFAULT_ACADEMIC_STAGES.forEach((s, i) => {
    const ref = doc(stagesCol);
    batch.set(ref, {
      labelAr: s.labelAr,
      category: s.category,
      ageRange: s.ageRange,
      order: i,
      monthlyTuitionMinorUnits: shekelsToMinorUnits(defaultFees[i] ?? 400),
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

export async function setStageMonthlyFee(stageId, monthlyTuitionShekels) {
  await updateStage(stageId, {
    monthlyTuitionMinorUnits: monthlyTuitionShekels != null && monthlyTuitionShekels !== ''
      ? shekelsToMinorUnits(monthlyTuitionShekels)
      : null,
  });
}
