import { useEffect, useState } from 'react';
import Modal from '../components/Modal';
import { Field } from '../components/ui';
import PhoneWhatsAppField from '../components/PhoneWhatsAppField';
import {
  composeFullName, GUARDIAN_WORK_STATUS_OPTIONS,
  HOUSING_TYPE_OPTIONS, SECTION_OPTIONS,
} from '../lib/constants';
import { isValidLocalMobile, normalizeLocalMobile, phoneKeyFromLocal, toE164Display, toWhatsAppNumber } from '../lib/phone';
import { useAcademicStages } from '../hooks/useAcademicStages';
import { useAcademicYearLabel } from '../components/AcademicYearText';
import { createStudent } from '../services/students';
import { logActivity } from '../services/activity';
import { useAuth } from '../context/AuthContext';

export default function NewStudentModal({ onClose, demo }) {
  const { profile } = useAuth();
  const { stages, labels } = useAcademicStages();
  const { academicYear: liveYear } = useAcademicYearLabel();
  const [nameFirst, setNameFirst] = useState('');
  const [nameFather, setNameFather] = useState('');
  const [nameGrandfather, setNameGrandfather] = useState('');
  const [nameFamily, setNameFamily] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [phoneDial, setPhoneDial] = useState('970');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [residentialAddress, setResidentialAddress] = useState('');
  const [guardianWorkStatus, setGuardianWorkStatus] = useState(GUARDIAN_WORK_STATUS_OPTIONS[0]);
  const [housingType, setHousingType] = useState(HOUSING_TYPE_OPTIONS[0]);
  const [stageId, setStageId] = useState('');
  const [classSection, setClassSection] = useState(SECTION_OPTIONS[0]);
  const [ageYears, setAgeYears] = useState('');
  const [academicYear, setAcademicYear] = useState(liveYear);
  const [shift, setShift] = useState('صباحي');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!stageId && stages[0]) setStageId(stages[0].id);
  }, [stages, stageId]);

  useEffect(() => {
    setAcademicYear(liveYear);
  }, [liveYear]);
  const selectedStage = stages.find((s) => s.id === stageId) || stages[0];
  const stageLabel = selectedStage?.labelAr || labels[0] || '';

  const onSubmit = async (e) => {
    e.preventDefault();
    const fullName = composeFullName({ nameFirst, nameFather, nameGrandfather, nameFamily });
    if (!fullName) { setError('أدخل الاسم الرباعي.'); return; }
    if (!nationalId.trim()) { setError('رقم الهوية مطلوب.'); return; }
    if (!isValidLocalMobile(phoneLocal)) { setError('أدخل رقم واتساب ولي الأمر بمقدمة +970 أو +972.'); return; }
    if (!residentialAddress.trim()) { setError('عنوان السكن مطلوب.'); return; }
    if (demo) { setError('وضع العرض التوضيحي: صِل مشروع Firebase (راجع .env.local) لحفظ الطلاب فعلياً.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const phoneE164 = toE164Display(phoneDial, phoneLocal);
      const phoneWa = toWhatsAppNumber(phoneDial, phoneLocal);
      const studentId = await createStudent({
        nameFirst, nameFather, nameGrandfather, nameFamily,
        nationalId, guardianName,
        guardianPhone: phoneE164,
        guardianPhoneDial: phoneDial,
        guardianPhoneLocal: normalizeLocalMobile(phoneLocal),
        guardianPhoneE164: phoneE164,
        guardianPhoneWa: phoneWa,
        guardianPhoneKey: phoneKeyFromLocal(phoneLocal),
        residentialAddress,
        guardianWorkStatus,
        housingType,
        stageId: selectedStage?.id, stageLabel, classSection,
        ageYears, academicYear, shift,
      });
      await logActivity({
        type: 'student_created', actorUid: profile?.id, actorName: profile?.name, actorRole: profile?.role,
        summary: `تسجيل طالب جديد: ${fullName} — ${stageLabel}`, targetType: 'student', targetId: studentId,
      });
      onClose();
    } catch {
      setError('تعذّر حفظ الطالب. حاول مجدداً.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="تسجيل طالب جديد" onClose={onClose} onSubmit={onSubmit} submitLabel="حفظ الطالب" submitting={submitting} error={error} width={560}>
      <div className="dialog-body">الاسم الرباعي، رقم الهوية، وبيانات ولي الأمر (واتساب، عنوان السكن، العمل، نوع السكن).</div>
      <div className="site-grid-2">
        <Field label="الاسم الأول"><input className="input" value={nameFirst} onChange={(e) => setNameFirst(e.target.value)} required /></Field>
        <Field label="اسم الأب"><input className="input" value={nameFather} onChange={(e) => setNameFather(e.target.value)} required /></Field>
        <Field label="اسم الجد"><input className="input" value={nameGrandfather} onChange={(e) => setNameGrandfather(e.target.value)} required /></Field>
        <Field label="العائلة"><input className="input" value={nameFamily} onChange={(e) => setNameFamily(e.target.value)} required /></Field>
      </div>
      <div className="site-grid-2">
        <Field label="رقم الهوية">
          <input className="input" value={nationalId} onChange={(e) => setNationalId(e.target.value)} required dir="ltr" style={{ textAlign: 'right' }} placeholder="9 أرقام" />
        </Field>
        <Field label="العمر (سنوات)">
          <input className="input" type="number" min="3" max="20" value={ageYears} onChange={(e) => setAgeYears(e.target.value)} dir="ltr" style={{ textAlign: 'right' }} />
        </Field>
      </div>
      <Field label="ولي الأمر"><input className="input" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} required /></Field>
      <PhoneWhatsAppField dialCode={phoneDial} localPhone={phoneLocal} onDialChange={setPhoneDial} onLocalChange={setPhoneLocal} />
      <Field label="عنوان السكن">
        <input
          className="input"
          value={residentialAddress}
          onChange={(e) => setResidentialAddress(e.target.value)}
          required
          placeholder="المدينة / الحي / الشارع…"
        />
      </Field>
      <div className="site-grid-2">
        <Field label="حالة العمل">
          <select className="input" value={guardianWorkStatus} onChange={(e) => setGuardianWorkStatus(e.target.value)} required>
            {GUARDIAN_WORK_STATUS_OPTIONS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="نوع السكن">
          <select className="input" value={housingType} onChange={(e) => setHousingType(e.target.value)} required>
            {HOUSING_TYPE_OPTIONS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </Field>
      </div>
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
        <Field label="السنة الدراسية">
          <input className="input" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} required />
        </Field>
      </div>
      <Field label="الفترة">
        <select className="input" value={shift} onChange={(e) => setShift(e.target.value)}>
          <option>صباحي</option><option>مسائي</option>
        </select>
      </Field>
    </Modal>
  );
}
