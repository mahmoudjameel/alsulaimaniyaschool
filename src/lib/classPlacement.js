import { SECTION_OPTIONS } from './constants';

/** Split "الخامس الأساسي / أ" → stage + section. */
export function parseStageAndSection(label) {
  const raw = String(label || '').trim();
  if (!raw) return { stage: '', section: null };
  const m = raw.match(/^(.*?)\s*\/\s*([أبجد])\s*$/u);
  if (m) return { stage: m[1].trim(), section: m[2] };
  return { stage: raw, section: null };
}

function normStage(s) {
  return String(s || '').trim().replace(/\s+/g, ' ');
}

/** Resolve شعبة from class doc (field, grade label, or title). */
export function resolveClassSection(cls) {
  if (!cls) return null;
  if (cls.classSection && SECTION_OPTIONS.includes(cls.classSection)) return cls.classSection;
  const fromGrade = parseStageAndSection(cls.grade).section;
  if (fromGrade) return fromGrade;
  const title = String(cls.title || '');
  const m = title.match(/(?:^|[\s\/·\-])([أبجد])\s*$/u)
    || title.match(/شعبة\s*([أبجد])/u)
    || title.match(/\b([أبجد])\b/u);
  return m && SECTION_OPTIONS.includes(m[1]) ? m[1] : null;
}

export function resolveClassStage(cls) {
  if (!cls) return '';
  const parsed = parseStageAndSection(cls.grade);
  return normStage(parsed.stage || cls.grade || '');
}

export function resolveStudentStage(student) {
  if (!student) return '';
  if (student.stageLabel) return normStage(student.stageLabel);
  return normStage(parseStageAndSection(student.grade).stage);
}

export function resolveStudentSection(student) {
  if (!student) return null;
  if (student.classSection && SECTION_OPTIONS.includes(student.classSection)) {
    return student.classSection;
  }
  return parseStageAndSection(student.grade).section;
}

/**
 * True when a class is the right classroom for this student's registration
 * (مرحلة + شعبة + دوام).
 */
export function classMatchesStudent(cls, student) {
  if (!cls || !student) return false;
  const studentStage = resolveStudentStage(student);
  const classStage = resolveClassStage(cls);
  if (!studentStage || !classStage) return false;
  if (classStage !== studentStage && normStage(cls.grade) !== normStage(student.grade)) {
    return false;
  }

  const studentShift = student.shift || null;
  const classShift = cls.shift || null;
  if (studentShift && classShift && studentShift !== classShift) return false;

  const studentSection = resolveStudentSection(student);
  const classSection = resolveClassSection(cls);
  // If the class is tied to a شعبة, only that section's students join.
  if (classSection && studentSection && classSection !== studentSection) return false;
  if (classSection && !studentSection) return false;

  return true;
}

export function filterClassesForStudent(classes, student) {
  return (classes || []).filter((c) => classMatchesStudent(c, student));
}

export function filterStudentsForClass(students, cls) {
  return (students || []).filter((s) => (
    s.status !== 'متخرّج'
    && s.status !== 'منسحب'
    && classMatchesStudent(cls, s)
  ));
}
