import { useEffect, useMemo, useState } from 'react';
import Modal from '../components/Modal';
import { Field } from '../components/ui';
import PhoneWhatsAppField from '../components/PhoneWhatsAppField';
import {
  composeFullName, formatGradeLabel, formatILS, GUARDIAN_WORK_STATUS_OPTIONS,
  HOUSING_TYPE_OPTIONS, SECTION_OPTIONS,
} from '../lib/constants';
import { isValidLocalMobile, normalizeLocalMobile, phoneKeyFromLocal, toE164Display, toWhatsAppNumber } from '../lib/phone';
import { ageFromBirthDate, birthDateBounds, isPlausibleStudentBirthDate } from '../lib/birthDate';
import { ACADEMIC_TUITION_MONTHS, academicTuitionPeriods, tuitionPlanTotals } from '../lib/billingPeriods';
import { useAcademicStages } from '../hooks/useAcademicStages';
import { useAcademicYearLabel } from '../components/AcademicYearText';
import { createStudent } from '../services/students';
import { enrollStudentInMatchingClasses } from '../services/academics';
import { createAcademicYearTuitionPlan, createSeatReservationCharge } from '../services/finance';
import { logActivity } from '../services/activity';
import { useAuth } from '../context/AuthContext';

const BIRTH_BOUNDS = birthDateBounds();

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
  const [birthDate, setBirthDate] = useState('');
  const [academicYear, setAcademicYear] = useState(liveYear);
  const [shift, setShift] = useState('صباحي');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (!stageId && stages[0]) setStageId(stages[0].id);
  }, [stages, stageId]);

  useEffect(() => {
    setAcademicYear(liveYear);
  }, [liveYear]);

  const selectedStage = stages.find((s) => s.id === stageId) || stages[0];
  const stageLabel = selectedStage?.labelAr || labels[0] || '';
  const gradeLabel = formatGradeLabel(stageLabel, classSection) || stageLabel;

  const billingPreview = useMemo(() => {
    const monthly = Number(selectedStage?.monthlyTuitionMinorUnits) || 0;
    const seat = Number(selectedStage?.seatReservationMinorUnits) || 0;
    return {
      ...tuitionPlanTotals(monthly, seat),
      periods: academicTuitionPeriods(academicYear),
    };
  }, [selectedStage, academicYear]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (summary) { onClose(); return; }
    const fullName = composeFullName({ nameFirst, nameFather, nameGrandfather, nameFamily });
    if (!fullName) { setError('أدخل الاسم الرباعي.'); return; }
    if (!nationalId.trim()) { setError('رقم الهوية مطلوب.'); return; }
    if (!isValidLocalMobile(phoneLocal)) { setError('أدخل رقم واتساب ولي الأمر بمقدمة +970 أو +972.'); return; }
    if (!residentialAddress.trim()) { setError('عنوان السكن مطلوب.'); return; }
    if (birthDate && !isPlausibleStudentBirthDate(birthDate)) {
      setError('تاريخ الميلاد غير منطقي لطالب (3–20 سنة).');
      return;
    }
    if (demo) { setError('وضع العرض التوضيحي: صِل مشروع Firebase (راجع .env.local) لحفظ الطلاب فعلياً.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const phoneE164 = toE164Display(phoneDial, phoneLocal);
      const phoneWa = toWhatsAppNumber(phoneDial, phoneLocal);
      const ageYears = ageFromBirthDate(birthDate);
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
        birthDate: birthDate || null,
        ageYears, academicYear, shift,
      });

      const placement = await enrollStudentInMatchingClasses({
        id: studentId,
        name: fullName,
        displayId: null,
        grade: gradeLabel,
        stageLabel,
        classSection,
        shift,
        status: 'نشط',
      });

      const seatFee = Number(selectedStage?.seatReservationMinorUnits) || 0;
      if (seatFee > 0) {
        await createSeatReservationCharge({
          studentId,
          studentName: fullName,
          stageId: selectedStage?.id,
          stageLabel,
          amountMinorUnits: seatFee,
        });
      }

      const monthly = Number(selectedStage?.monthlyTuitionMinorUnits) || 0;
      let tuitionPlan = { created: 0, months: ACADEMIC_TUITION_MONTHS, monthlyMinorUnits: monthly };
      if (monthly > 0) {
        tuitionPlan = await createAcademicYearTuitionPlan({
          studentId,
          studentName: fullName,
          stageId: selectedStage?.id,
          stageLabel,
          classSection,
          grade: gradeLabel,
          academicYear,
          monthlyTuitionMinorUnits: monthly,
        });
      }

      const totals = tuitionPlanTotals(monthly, seatFee);
      await logActivity({
        type: 'student_created',
        actorUid: profile?.id,
        actorName: profile?.name,
        actorRole: profile?.role,
        summary: [
          `تسجيل طالب جديد: ${fullName} — ${gradeLabel}`,
          placement.enrolled > 0 ? `· ${placement.enrolled} صف` : '',
          seatFee > 0 ? `· حجز مقعد ${formatILS(seatFee)}` : '',
          monthly > 0 ? `· ${tuitionPlan.created} قسطاً شهرياً × ${formatILS(monthly)}` : '',
        ].filter(Boolean).join(' '),
        targetType: 'student',
        targetId: studentId,
      });

      setSummary({
        studentId,
        name: fullName,
        gradeLabel,
        shift,
        classes: placement.classes || [],
        seatFee,
        monthly,
        tuitionCreated: tuitionPlan.created,
        months: ACADEMIC_TUITION_MONTHS,
        totals,
        periods: academicTuitionPeriods(academicYear),
      });
    } catch {
      setError('تعذّر حفظ الطالب. حاول مجدداً.');
    } finally {
      setSubmitting(false);
    }
  };

  if (summary) {
    return (
      <Modal
        title="تم تسجيل الطالب"
        onClose={onClose}
        onSubmit={(e) => { e.preventDefault(); onClose(); }}
        submitLabel="حسناً"
        submitting={false}
        error=""
        width={560}
      >
        <div className="dialog-body" style={{ lineHeight: 1.7 }}>
          <strong>{summary.name}</strong> — {summary.gradeLabel} · {summary.shift}
        </div>

        <div className="field">
          <label>الصفوف التي انتقل إليها</label>
          {summary.classes.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>
              لا صفوف مطابقة بعد — أنشئ صفّاً بنفس المرحلة والشعبة والدوام، أو وزّع من ملف الطالب.
            </div>
          ) : (
            <ul style={{ margin: '6px 0 0', paddingInlineStart: 18, fontSize: 13, lineHeight: 1.7 }}>
              {summary.classes.map((c) => (
                <li key={c.id}>
                  {c.title}
                  {c.subject ? ` · ${c.subject}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="field">
          <label>الخطة المالية ({academicYear})</label>
          <div style={{ fontSize: 13, lineHeight: 1.8, marginTop: 4 }}>
            <div>حجز مقعد: <strong className="ah-tabnum">{summary.seatFee > 0 ? formatILS(summary.seatFee) : '—'}</strong></div>
            <div>
              القسط الشهري: <strong className="ah-tabnum">{summary.monthly > 0 ? formatILS(summary.monthly) : '—'}</strong>
              {' '}× {summary.months} أشهر
              {summary.monthly > 0 ? (
                <> = <strong className="ah-tabnum">{formatILS(summary.totals.tuitionTotalMinorUnits)}</strong></>
              ) : null}
            </div>
            <div>
              الإجمالي المستحق: <strong className="ah-tabnum" style={{ color: 'var(--gold)' }}>{formatILS(summary.totals.grandTotalMinorUnits)}</strong>
            </div>
            {summary.tuitionCreated > 0 && (
              <div style={{ color: 'var(--color-neutral-600)', marginTop: 4 }}>
                أُنشئت {summary.tuitionCreated} فاتورة شهرية (مسودّة) — أيلول حتى حزيران.
              </div>
            )}
          </div>
        </div>

        {summary.monthly > 0 && (
          <div className="field">
            <label>أقساط الأشهر العشرة</label>
            <div style={{ maxHeight: 160, overflow: 'auto', fontSize: 12, lineHeight: 1.6, border: '1px solid var(--line)', borderRadius: 8, padding: 10 }}>
              {summary.periods.map((p) => (
                <div key={p.period} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span>{p.labelAr}</span>
                  <span className="ah-tabnum">{formatILS(summary.monthly)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    );
  }

  return (
    <Modal title="تسجيل طالب جديد" onClose={onClose} onSubmit={onSubmit} submitLabel="حفظ الطالب" submitting={submitting} error={error} width={560}>
      <div className="dialog-body">
        بعد الحفظ: توزيع على الصفوف + حجز مقعد + {ACADEMIC_TUITION_MONTHS} أقساط شهرية حسب المرحلة.
      </div>
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
        <Field label="تاريخ الميلاد">
          <input
            className="input"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            min={BIRTH_BOUNDS.min}
            max={BIRTH_BOUNDS.max}
            dir="ltr"
            style={{ textAlign: 'right' }}
          />
          {ageFromBirthDate(birthDate) != null && (
            <div style={{ fontSize: 11, color: 'var(--color-neutral-500)', marginTop: 4 }}>
              العمر: {ageFromBirthDate(birthDate)} سنة
            </div>
          )}
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

      <div
        className="card"
        style={{
          padding: 12,
          background: 'var(--color-accent-100)',
          borderColor: 'var(--color-accent-300)',
          fontSize: 13,
          lineHeight: 1.75,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4 }}>ملخّص عند الحفظ — {gradeLabel}</div>
        <div>حجز مقعد: <strong className="ah-tabnum">{billingPreview.seatMinorUnits > 0 ? formatILS(billingPreview.seatMinorUnits) : '—'}</strong></div>
        <div>
          قسط شهري: <strong className="ah-tabnum">{billingPreview.monthlyMinorUnits > 0 ? formatILS(billingPreview.monthlyMinorUnits) : '—'}</strong>
          {' '}× {ACADEMIC_TUITION_MONTHS} أشهر = <strong className="ah-tabnum">{formatILS(billingPreview.tuitionTotalMinorUnits)}</strong>
        </div>
        <div>
          الإجمالي: <strong className="ah-tabnum" style={{ color: 'var(--gold)' }}>{formatILS(billingPreview.grandTotalMinorUnits)}</strong>
          <span style={{ color: 'var(--color-neutral-600)' }}> (أيلول → حزيران)</span>
        </div>
      </div>
    </Modal>
  );
}
