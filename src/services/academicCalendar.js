import { collection, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { CURRENT_ACADEMIC_YEAR, formatGradeLabel } from '../lib/constants';
import { resolveAcademicYear } from '../lib/liveAcademicYear';
import { schoolSettingsRef } from './schoolSite';
import { studentsCol, updateStudent } from './students';
import { clearStudentEnrollments } from './academics';
import { logActivity } from './activity';

export { resolveAcademicYear } from '../lib/liveAcademicYear';

const gradeEntriesCol = collection(db, 'gradeEntries');

export const ACADEMIC_TERMS = ['الفصل الأول', 'الفصل الثاني'];

/** Defaults when schoolSettings/main has no calendar fields. */
export function defaultAcademicCalendar() {
  return {
    academicYear: CURRENT_ACADEMIC_YEAR,
    activeTerm: ACADEMIC_TERMS[0],
    closedTerms: [],
    lastRolloverAt: null,
    lastRolloverBy: null,
    lastRolloverByName: null,
    lastRolloverSummary: null,
  };
}

export function mergeAcademicCalendar(data = {}) {
  const base = defaultAcademicCalendar();
  const closed = Array.isArray(data.closedTerms)
    ? data.closedTerms.filter((t) => ACADEMIC_TERMS.includes(t))
    : base.closedTerms;
  return {
    ...base,
    academicYear: (data.academicYear || base.academicYear).trim() || base.academicYear,
    activeTerm: ACADEMIC_TERMS.includes(data.activeTerm) ? data.activeTerm : base.activeTerm,
    closedTerms: closed,
    lastRolloverAt: data.lastRolloverAt || null,
    lastRolloverBy: data.lastRolloverBy || null,
    lastRolloverByName: data.lastRolloverByName || null,
    lastRolloverSummary: data.lastRolloverSummary || null,
  };
}

export async function fetchAcademicCalendar() {
  const snap = await getDoc(schoolSettingsRef());
  if (!snap.exists()) return defaultAcademicCalendar();
  return mergeAcademicCalendar(snap.data());
}

export async function saveAcademicCalendar(patch, actor) {
  const current = await fetchAcademicCalendar();
  const next = mergeAcademicCalendar({ ...current, ...patch });
  await setDoc(schoolSettingsRef(), {
    academicYear: next.academicYear,
    activeTerm: next.activeTerm,
    closedTerms: next.closedTerms,
    updatedAt: serverTimestamp(),
    updatedBy: actor?.uid || null,
    updatedByName: actor?.name || null,
  }, { merge: true });
  await logActivity({
    type: 'academic_calendar_updated',
    actorUid: actor?.uid,
    actorName: actor?.name,
    actorRole: actor?.role || 'admin',
    summary: `تحديث العام الدراسي: ${next.academicYear} · الفصل النشط ${next.activeTerm}`,
    targetType: 'schoolSettings',
    targetId: 'main',
  }).catch(() => {});
  return next;
}

export async function setTermClosed(term, locked, actor) {
  if (!ACADEMIC_TERMS.includes(term)) throw new Error('INVALID_TERM');
  const current = await fetchAcademicCalendar();
  const set = new Set(current.closedTerms);
  if (locked) set.add(term);
  else set.delete(term);
  const closedTerms = ACADEMIC_TERMS.filter((t) => set.has(t));
  await setDoc(schoolSettingsRef(), {
    closedTerms,
    updatedAt: serverTimestamp(),
    updatedBy: actor?.uid || null,
    updatedByName: actor?.name || null,
  }, { merge: true });
  await logActivity({
    type: locked ? 'term_closed' : 'term_reopened',
    actorUid: actor?.uid,
    actorName: actor?.name,
    actorRole: actor?.role || 'admin',
    summary: locked ? `إغلاق وقفل إدخال درجات «${term}»` : `إعادة فتح إدخال درجات «${term}»`,
    targetType: 'schoolSettings',
    targetId: 'main',
  }).catch(() => {});
  return closedTerms;
}

/** Throws TERM_CLOSED if the term is locked for new grade entries. */
export async function assertTermOpen(term) {
  if (!term) return;
  const cal = await fetchAcademicCalendar();
  if (cal.closedTerms.includes(term)) {
    const err = new Error('TERM_CLOSED');
    err.code = 'TERM_CLOSED';
    err.term = term;
    throw err;
  }
}

export function isTermClosed(calendar, term) {
  return Boolean(term && calendar?.closedTerms?.includes(term));
}

/** Count pending grade entries for a term (client filter — no composite index). */
export async function countPendingGradesForTerm(term) {
  const snap = await getDocs(query(gradeEntriesCol, where('status', '==', 'قيد المراجعة')));
  let n = 0;
  snap.forEach((d) => {
    if ((d.data().term || '') === term) n += 1;
  });
  return n;
}

/**
 * Build promotion plan for active students using stages sorted by order.
 * stages: [{ id, labelAr, order }]
 */
export function buildRolloverPlan(students, stages, newAcademicYear) {
  const ordered = [...(stages || [])]
    .filter((s) => s.active !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const byId = new Map(ordered.map((s) => [s.id, s]));
  const byLabel = new Map(ordered.map((s) => [s.labelAr, s]));

  const promote = [];
  const graduate = [];
  const skipped = [];

  (students || [])
    .filter((s) => (s.status || 'نشط') === 'نشط')
    .forEach((student) => {
      let idx = -1;
      if (student.stageId && byId.has(student.stageId)) {
        idx = ordered.findIndex((s) => s.id === student.stageId);
      } else if (student.stageLabel && byLabel.has(student.stageLabel)) {
        idx = ordered.findIndex((s) => s.labelAr === student.stageLabel);
      } else if (student.grade) {
        const label = String(student.grade).split('/')[0].trim();
        if (byLabel.has(label)) idx = ordered.findIndex((s) => s.labelAr === label);
      }

      if (idx < 0) {
        skipped.push({ id: student.id, name: student.name, reason: 'مرحلة غير معروفة' });
        return;
      }

      if (idx >= ordered.length - 1) {
        graduate.push({
          id: student.id,
          name: student.name,
          fromLabel: ordered[idx].labelAr,
          section: student.classSection || null,
        });
        return;
      }

      const next = ordered[idx + 1];
      const section = student.classSection || null;
      promote.push({
        id: student.id,
        name: student.name,
        fromLabel: ordered[idx].labelAr,
        toStageId: next.id,
        toLabel: next.labelAr,
        section,
        grade: formatGradeLabel(next.labelAr, section),
        academicYear: newAcademicYear,
      });
    });

  return {
    newAcademicYear,
    promote,
    graduate,
    skipped,
    totals: {
      active: promote.length + graduate.length + skipped.length,
      promote: promote.length,
      graduate: graduate.length,
      skipped: skipped.length,
    },
  };
}

/**
 * Apply rollover: promote, graduate, bump year, optionally clear enrollments.
 */
export async function runYearRollover({
  plan,
  clearEnrollments = true,
  actor,
}) {
  if (!plan?.newAcademicYear) throw new Error('MISSING_YEAR');
  const summary = {
    promoted: 0,
    graduated: 0,
    skipped: plan.skipped?.length || 0,
    unenrolled: 0,
    errors: [],
  };

  for (const row of plan.promote || []) {
    try {
      if (clearEnrollments) {
        summary.unenrolled += await clearStudentEnrollments(row.id);
      }
      await updateStudent(row.id, {
        stageId: row.toStageId,
        stageLabel: row.toLabel,
        classSection: row.section,
        grade: row.grade,
        academicYear: plan.newAcademicYear,
        status: 'نشط',
      });
      summary.promoted += 1;
    } catch (err) {
      summary.errors.push({ id: row.id, name: row.name, error: err?.message || 'promote_failed' });
    }
  }

  for (const row of plan.graduate || []) {
    try {
      if (clearEnrollments) {
        summary.unenrolled += await clearStudentEnrollments(row.id);
      }
      await updateStudent(row.id, {
        status: 'متخرّج',
        academicYear: plan.newAcademicYear,
      });
      summary.graduated += 1;
    } catch (err) {
      summary.errors.push({ id: row.id, name: row.name, error: err?.message || 'graduate_failed' });
    }
  }

  await setDoc(schoolSettingsRef(), {
    academicYear: plan.newAcademicYear,
    activeTerm: ACADEMIC_TERMS[0],
    closedTerms: [],
    lastRolloverAt: serverTimestamp(),
    lastRolloverBy: actor?.uid || null,
    lastRolloverByName: actor?.name || null,
    lastRolloverSummary: {
      promoted: summary.promoted,
      graduated: summary.graduated,
      skipped: summary.skipped,
      unenrolled: summary.unenrolled,
      errorCount: summary.errors.length,
    },
    updatedAt: serverTimestamp(),
    updatedBy: actor?.uid || null,
    updatedByName: actor?.name || null,
  }, { merge: true });

  await logActivity({
    type: 'year_rollover',
    actorUid: actor?.uid,
    actorName: actor?.name,
    actorRole: actor?.role || 'admin',
    summary: `ترحيل العام إلى ${plan.newAcademicYear}: ترقية ${summary.promoted} · تخرج ${summary.graduated}`,
    targetType: 'schoolSettings',
    targetId: 'main',
  }).catch(() => {});

  return summary;
}

/** Load all students once for rollover planning. */
export async function fetchAllStudentsForRollover() {
  const snap = await getDocs(studentsCol);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
