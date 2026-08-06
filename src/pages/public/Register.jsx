import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import PhoneWhatsAppField from '../../components/PhoneWhatsAppField';
import {
  GUARDIAN_WORK_STATUS_OPTIONS, HOUSING_TYPE_OPTIONS, SCHOOL_LOCATION_AR, SCHOOL_NAME_AR,
  SECTION_OPTIONS,
} from '../../lib/constants';
import {
  ageFromBirthDate, birthDateBounds, isPlausibleStudentBirthDate,
} from '../../lib/birthDate';
import { isValidLocalMobile, normalizeLocalMobile, toE164Display, toWhatsAppNumber } from '../../lib/phone';
import { useAcademicStages } from '../../hooks/useAcademicStages';
import { useAcademicYearLabel } from '../../components/AcademicYearText';
import { submitRegistration } from '../../services/registrations';
import { heroImg } from '../../data/demo';

const CONTACT_METHODS = ['واتساب', 'اتصال هاتفي', 'بريد إلكتروني'];
const BIRTH_BOUNDS = birthDateBounds();

const emptyForm = (stageId = '', stageLabel = '', academicYear = '') => ({
  guardianName: '', phoneDial: '970', phoneLocal: '',
  residentialAddress: '', guardianWorkStatus: GUARDIAN_WORK_STATUS_OPTIONS[0], housingType: HOUSING_TYPE_OPTIONS[0],
  nameFirst: '', nameFather: '', nameGrandfather: '', nameFamily: '',
  nationalId: '', birthDate: '',
  stageId, stageLabel, classSection: SECTION_OPTIONS[0],
  academicYear,
  contactMethod: CONTACT_METHODS[0], notes: '', consent: true,
});

function FormSection({ step, title, hint, children }) {
  return (
    <section className="reg-section">
      <header className="reg-section-head">
        <span className="reg-step" aria-hidden="true">{step}</span>
        <div>
          <h2 className="reg-section-title">{title}</h2>
          {hint && <p className="reg-section-hint">{hint}</p>}
        </div>
      </header>
      <div className="reg-section-body">{children}</div>
    </section>
  );
}

export default function Register() {
  const navigate = useNavigate();
  const { stages } = useAcademicStages();
  const { academicYear: liveYear } = useAcademicYearLabel();
  const [registered, setRegistered] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(() => emptyForm('', '', liveYear));

  useEffect(() => {
    setForm((prev) => (prev.academicYear ? prev : { ...prev, academicYear: liveYear }));
  }, [liveYear]);

  useEffect(() => {
    if (stages[0] && !form.stageId) {
      setForm((f) => ({ ...f, stageId: stages[0].id, stageLabel: stages[0].labelAr }));
    }
  }, [stages, form.stageId]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const computedAge = useMemo(() => ageFromBirthDate(form.birthDate), [form.birthDate]);

  const onStageChange = (e) => {
    const id = e.target.value;
    const stage = stages.find((s) => s.id === id);
    setForm((f) => ({ ...f, stageId: id, stageLabel: stage?.labelAr || '' }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.consent) { setError('يلزم الموافقة على تواصل مكتب القبول لإتمام الطلب.'); return; }
    if (!form.nameFirst.trim() || !form.nameFather.trim() || !form.nameGrandfather.trim() || !form.nameFamily.trim()) {
      setError('أدخل الاسم الرباعي كاملاً.');
      return;
    }
    if (!form.nationalId.trim()) { setError('رقم الهوية مطلوب.'); return; }
    if (!form.birthDate || !isPlausibleStudentBirthDate(form.birthDate)) {
      setError('أدخل تاريخ ميلاد صحيح (عمر الطالب بين 3 و 20 سنة).');
      return;
    }
    if (!isValidLocalMobile(form.phoneLocal)) {
      setError('أدخل رقم واتساب صحيح مثل 0592799888 واختر المقدمة +970 أو +972.');
      return;
    }
    if (!form.residentialAddress.trim()) {
      setError('عنوان السكن مطلوب.');
      return;
    }
    const phoneE164 = toE164Display(form.phoneDial, form.phoneLocal);
    const phoneWa = toWhatsAppNumber(form.phoneDial, form.phoneLocal);
    const ageYears = ageFromBirthDate(form.birthDate);
    setSubmitting(true);
    setError('');
    try {
      await submitRegistration({
        ...form,
        birthDate: form.birthDate,
        ageYears,
        phone: phoneE164,
        phoneDial: form.phoneDial,
        phoneLocal: normalizeLocalMobile(form.phoneLocal),
        phoneE164,
        phoneWa,
      });
      setRegistered(true);
      window.scrollTo(0, 0);
    } catch {
      setError('تعذّر إرسال الطلب. تحقق من اتصالك وحاول مجدداً.');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setForm(emptyForm(stages[0]?.id, stages[0]?.labelAr, liveYear));
    setRegistered(false);
    setError('');
  };

  return (
    <div className="reg-page">
      <section className="reg-hero" aria-labelledby="reg-brand">
        <div className="reg-hero-media" style={{ backgroundImage: `url('${heroImg}')` }} aria-hidden="true" />
        <div className="reg-hero-shade" aria-hidden="true" />
        <div className="reg-hero-inner">
          <p className="reg-hero-place">{SCHOOL_LOCATION_AR}</p>
          <h1 id="reg-brand" className="reg-hero-brand">{SCHOOL_NAME_AR}</h1>
          <p className="reg-hero-title">طلب تسجيل طالب</p>
          <p className="reg-hero-lead">
            عبّئ البيانات بدقّة. مكتب القبول يتواصل عبر واتساب الرقم المسجّل.
          </p>
        </div>
      </section>

      <div className="reg-body">
        {!registered ? (
          <form className="reg-panel" onSubmit={onSubmit} noValidate>
            <FormSection step="١" title="ولي الأمر" hint="بيانات التواصل والسكن">
              <div className="reg-fields">
                <div className="field reg-span-2">
                  <label htmlFor="reg-guardian">اسم ولي الأمر</label>
                  <input id="reg-guardian" className="input" value={form.guardianName} onChange={set('guardianName')} required autoComplete="name" />
                </div>
                <div className="reg-span-2">
                  <PhoneWhatsAppField
                    dialCode={form.phoneDial}
                    localPhone={form.phoneLocal}
                    onDialChange={(v) => setForm((f) => ({ ...f, phoneDial: v }))}
                    onLocalChange={(v) => setForm((f) => ({ ...f, phoneLocal: v }))}
                    required
                  />
                </div>
                <div className="field reg-span-2">
                  <label htmlFor="reg-address">عنوان السكن</label>
                  <input
                    id="reg-address"
                    className="input"
                    value={form.residentialAddress}
                    onChange={set('residentialAddress')}
                    required
                    placeholder="المدينة / الحي / الشارع…"
                    autoComplete="street-address"
                  />
                </div>
                <div className="field">
                  <label htmlFor="reg-work">حالة العمل</label>
                  <select id="reg-work" className="input" value={form.guardianWorkStatus} onChange={set('guardianWorkStatus')} required>
                    {GUARDIAN_WORK_STATUS_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="reg-housing">نوع السكن</label>
                  <select id="reg-housing" className="input" value={form.housingType} onChange={set('housingType')} required>
                    {HOUSING_TYPE_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>
            </FormSection>

            <FormSection step="٢" title="الطالب" hint="الاسم الرباعي ورقم الهوية وتاريخ الميلاد">
              <div className="reg-fields">
                <div className="field">
                  <label htmlFor="reg-first">الاسم الأول</label>
                  <input id="reg-first" className="input" value={form.nameFirst} onChange={set('nameFirst')} required />
                </div>
                <div className="field">
                  <label htmlFor="reg-father">اسم الأب</label>
                  <input id="reg-father" className="input" value={form.nameFather} onChange={set('nameFather')} required />
                </div>
                <div className="field">
                  <label htmlFor="reg-grand">اسم الجد</label>
                  <input id="reg-grand" className="input" value={form.nameGrandfather} onChange={set('nameGrandfather')} required />
                </div>
                <div className="field">
                  <label htmlFor="reg-family">العائلة</label>
                  <input id="reg-family" className="input" value={form.nameFamily} onChange={set('nameFamily')} required />
                </div>
                <div className="field">
                  <label htmlFor="reg-nid">رقم الهوية</label>
                  <input id="reg-nid" className="input" value={form.nationalId} onChange={set('nationalId')} required dir="ltr" inputMode="numeric" />
                </div>
                <div className="field">
                  <label htmlFor="reg-birth">تاريخ الميلاد</label>
                  <input
                    id="reg-birth"
                    className="input"
                    type="date"
                    value={form.birthDate}
                    onChange={set('birthDate')}
                    min={BIRTH_BOUNDS.min}
                    max={BIRTH_BOUNDS.max}
                    required
                    dir="ltr"
                  />
                  {computedAge != null && (
                    <p className="reg-field-hint">العمر: {computedAge} سنة</p>
                  )}
                </div>
              </div>
            </FormSection>

            <FormSection step="٣" title="المرحلة والتواصل" hint={`العام الدراسي ${form.academicYear || liveYear}`}>
              <div className="reg-fields">
                <div className="field">
                  <label htmlFor="reg-year">السنة الدراسية</label>
                  <input id="reg-year" className="input" value={form.academicYear} onChange={set('academicYear')} />
                </div>
                <div className="field">
                  <label htmlFor="reg-section">الشعبة المفضّلة</label>
                  <select id="reg-section" className="input" value={form.classSection} onChange={set('classSection')}>
                    {SECTION_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="field reg-span-2">
                  <label htmlFor="reg-stage">المرحلة الدراسية</label>
                  <select id="reg-stage" className="input" value={form.stageId} onChange={onStageChange} required>
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.labelAr}{s.ageRange ? ` — ${s.ageRange}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field reg-span-2">
                  <span className="reg-label">طريقة التواصل المفضّلة</span>
                  <div className="reg-seg" role="radiogroup" aria-label="طريقة التواصل">
                    {CONTACT_METHODS.map((m) => (
                      <label key={m} className="reg-seg-opt">
                        <input
                          type="radio"
                          name="pref"
                          checked={form.contactMethod === m}
                          onChange={() => setForm((f) => ({ ...f, contactMethod: m }))}
                        />
                        <span>{m}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="field reg-span-2">
                  <label htmlFor="reg-notes">ملاحظات (اختياري)</label>
                  <textarea id="reg-notes" className="input reg-textarea" placeholder="أي معلومة تودّ إخبارنا بها…" value={form.notes} onChange={set('notes')} rows={3} />
                </div>
              </div>
            </FormSection>

            <div className="reg-footer">
              <label className="reg-consent">
                <input type="checkbox" checked={form.consent} onChange={set('consent')} />
                <span className="reg-consent-box" aria-hidden="true" />
                <span>أوافق على أن يتواصل معي مكتب القبول عبر واتساب أو الهاتف</span>
              </label>
              {error && (
                <div className="reg-error" role="alert">
                  <Icon name="error" size={16} />
                  {error}
                </div>
              )}
              <button type="submit" className="btn btn-primary reg-submit" disabled={submitting}>
                {submitting ? 'جارٍ الإرسال…' : 'إرسال طلب التسجيل'}
              </button>
            </div>
          </form>
        ) : (
          <div className="reg-success" role="status">
            <div className="reg-success-icon" aria-hidden="true">
              <Icon name="check" size={36} />
            </div>
            <h2 className="reg-success-title">تم استلام طلبك</h2>
            <p className="reg-success-lead">
              شكراً لك. سيتواصل معك مكتب القبول على واتساب الرقم الذي سجّلته.
            </p>
            <div className="reg-success-actions">
              <button type="button" onClick={reset} className="btn btn-secondary">تسجيل طالب آخر</button>
              <button type="button" onClick={() => navigate('/site')} className="btn btn-primary">عودة للرئيسية</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
