import { useEffect, useState } from 'react';
import Modal from '../components/Modal';
import { Field } from '../components/ui';
import PhoneWhatsAppField from '../components/PhoneWhatsAppField';
import {
  composeFullName, CURRENT_ACADEMIC_YEAR, formatGradeLabel, SECTION_OPTIONS,
} from '../lib/constants';
import { isValidLocalMobile, normalizeLocalMobile, parseStoredPhone, phoneKeyFromLocal, toE164Display, toWhatsAppNumber } from '../lib/phone';
import { useAcademicStages } from '../hooks/useAcademicStages';
import { updateStudent } from '../services/students';
import { logActivity } from '../services/activity';
import { useAuth } from '../context/AuthContext';

const STATUS_OPTIONS = ['نشط', 'موقوف', 'متخرّج', 'منسحب'];

export default function EditStudentModal({ student, onClose, demo }) {
  const { profile } = useAuth();
  const { stages, labels } = useAcademicStages();
  const initialPhone = parseStoredPhone(student);

  const [nameFirst, setNameFirst] = useState(student.nameFirst || '');
  const [nameFather, setNameFather] = useState(student.nameFather || '');
  const [nameGrandfather, setNameGrandfather] = useState(student.nameGrandfather || '');
  const [nameFamily, setNameFamily] = useState(student.nameFamily || '');
  const [nationalId, setNationalId] = useState(student.nationalId || '');
  const [guardianName, setGuardianName] = useState(student.guardianName || '');
  const [phoneDial, setPhoneDial] = useState(initialPhone.dialCode || '970');
  const [phoneLocal, setPhoneLocal] = useState(initialPhone.local || '');
  const [stageId, setStageId] = useState(student.stageId || '');
  const [classSection, setClassSection] = useState(student.classSection || SECTION_OPTIONS[0]);
  const [ageYears, setAgeYears] = useState(student.ageYears ?? '');
  const [academicYear, setAcademicYear] = useState(student.academicYear || CURRENT_ACADEMIC_YEAR);
  const [shift, setShift] = useState(student.shift || 'صباحي');
  const [status, setStatus] = useState(student.status || 'نشط');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!stageId && (student.stageId || stages[0])) {
      setStageId(student.stageId || stages[0]?.id || '');
    }
  }, [stages, stageId, student.stageId]);

  useEffect(() => {
    if (!student.nameFirst && student.name) {
      const parts = String(student.name).trim().split(/\s+/);
      if (parts.length >= 1 && !nameFirst) setNameFirst(parts[0] || '');
      if (parts.length >= 2 && !nameFather) setNameFather(parts[1] || '');
      if (parts.length >= 3 && !nameGrandfather) setNameGrandfather(parts[2] || '');
      if (parts.length >= 4 && !nameFamily) setNameFamily(parts.slice(3).join(' '));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.id]);

  const selectedStage = stages.find((s) => s.id === stageId);
  const stageLabel = selectedStage?.labelAr || student.stageLabel || labels[0] || '';

  const onSubmit = async (e) => {
    e.preventDefault();
    const fullName = composeFullName({ nameFirst, nameFather, nameGrandfather, nameFamily }) || (student.name || '').trim();
    if (!fullName) { setError('أدخل الاسم الرباعي.'); return; }
    if (!nationalId.trim()) { setError('رقم الهوية مطلوب.'); return; }
    if (!isValidLocalMobile(phoneLocal)) { setError('رقم واتساب ولي الأمر غير صالح.'); return; }
    if (demo) { setError('وضع العرض التوضيحي: صِل مشروع Firebase لحفظ التعديلات فعلياً.'); return; }

    const phoneE164 = toE164Display(phoneDial, phoneLocal);
    const phoneWa = toWhatsAppNumber(phoneDial, phoneLocal);
    setSubmitting(true);
    setError('');
    try {
      const gradeLabel = formatGradeLabel(stageLabel, classSection) || stageLabel;
      await updateStudent(student.id, {
        name: fullName,
        nameFirst: nameFirst.trim() || null,
        nameFather: nameFather.trim() || null,
        nameGrandfather: nameGrandfather.trim() || null,
        nameFamily: nameFamily.trim() || null,
        nationalId: nationalId.trim(),
        guardianName: guardianName.trim() || '—',
        guardianPhone: phoneE164,
        guardianPhoneDial: phoneDial,
        guardianPhoneLocal: normalizeLocalMobile(phoneLocal),
        guardianPhoneE164: phoneE164,
        guardianPhoneWa: phoneWa,
        guardianPhoneKey: phoneKeyFromLocal(phoneLocal),
        stageId: selectedStage?.id || stageId || null,
        stageLabel,
        classSection: classSection || null,
        ageYears: ageYears !== '' ? Number(ageYears) : null,
        academicYear: academicYear || CURRENT_ACADEMIC_YEAR,
        grade: gradeLabel,
        shift,
        status,
        initial: fullName.charAt(0),
      });
      await logActivity({
        type: 'student_updated',
        actorUid: profile?.id,
        actorName: profile?.name,
        actorRole: profile?.role,
        summary: `تعديل بيانات الطالب: ${fullName}`,
        targetType: 'student',
        targetId: student.id,
      });
      onClose();
    } catch {
      setError('تعذّر حفظ التعديلات. حاول مجدداً.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="تعديل بيانات الطالب" onClose={onClose} onSubmit={onSubmit} submitLabel="حفظ التعديلات" submitting={submitting} error={error} width={560}>
      <div className="dialog-body">حدّث الاسم الرباعي، الهوية، المرحلة، وواتساب ولي الأمر (+970 / +972).</div>
      <div className="site-grid-2">
        <Field label="الاسم الأول"><input className="input" value={nameFirst} onChange={(e) => setNameFirst(e.target.value)} required /></Field>
        <Field label="اسم الأب"><input className="input" value={nameFather} onChange={(e) => setNameFather(e.target.value)} required /></Field>
        <Field label="اسم الجد"><input className="input" value={nameGrandfather} onChange={(e) => setNameGrandfather(e.target.value)} required /></Field>
        <Field label="العائلة"><input className="input" value={nameFamily} onChange={(e) => setNameFamily(e.target.value)} required /></Field>
      </div>
      <div className="site-grid-2">
        <Field label="رقم الهوية">
          <input className="input" value={nationalId} onChange={(e) => setNationalId(e.target.value)} required dir="ltr" style={{ textAlign: 'right' }} />
        </Field>
        <Field label="العمر (سنوات)">
          <input className="input" type="number" min="3" max="20" value={ageYears} onChange={(e) => setAgeYears(e.target.value)} dir="ltr" style={{ textAlign: 'right' }} />
        </Field>
      </div>
      <Field label="ولي الأمر"><input className="input" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} required /></Field>
      <PhoneWhatsAppField dialCode={phoneDial} localPhone={phoneLocal} onDialChange={setPhoneDial} onLocalChange={setPhoneLocal} />
      <div className="site-grid-3f">
        <Field label="المرحلة الدراسية">
          <select className="input" value={stageId} onChange={(e) => setStageId(e.target.value)} required>
            {stages.map((s) => <option key={s.id} value={s.id}>{s.labelAr}{s.ageRange ? ` (${s.ageRange})` : ''}</option>)}
          </select>
        </Field>
        <Field label="الشعبة">
          <select className="input" value={classSection} onChange={(e) => setClassSection(e.target.value)}>
            {SECTION_OPTIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="الحالة">
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <div className="site-grid-2">
        <Field label="الفترة">
          <select className="input" value={shift} onChange={(e) => setShift(e.target.value)}>
            <option>صباحي</option><option>مسائي</option>
          </select>
        </Field>
        <Field label="السنة الدراسية">
          <input className="input" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} required />
        </Field>
      </div>
    </Modal>
  );
}
