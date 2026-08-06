import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import PhoneWhatsAppField from '../../components/PhoneWhatsAppField';
import {
  GUARDIAN_WORK_STATUS_OPTIONS, HOUSING_TYPE_OPTIONS, SECTION_OPTIONS,
} from '../../lib/constants';
import { isValidLocalMobile, normalizeLocalMobile, toE164Display, toWhatsAppNumber } from '../../lib/phone';
import { useAcademicStages } from '../../hooks/useAcademicStages';
import { useAcademicYearLabel } from '../../components/AcademicYearText';
import { submitRegistration } from '../../services/registrations';

const CONTACT_METHODS = ['واتساب', 'اتصال هاتفي', 'بريد إلكتروني'];

const emptyForm = (stageId = '', stageLabel = '', academicYear = '') => ({
  guardianName: '', phoneDial: '970', phoneLocal: '',
  residentialAddress: '', guardianWorkStatus: GUARDIAN_WORK_STATUS_OPTIONS[0], housingType: HOUSING_TYPE_OPTIONS[0],
  nameFirst: '', nameFather: '', nameGrandfather: '', nameFamily: '',
  nationalId: '', ageYears: '',
  stageId, stageLabel, classSection: SECTION_OPTIONS[0],
  academicYear,
  contactMethod: CONTACT_METHODS[0], notes: '', consent: true,
});

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
    setSubmitting(true);
    setError('');
    try {
      await submitRegistration({
        ...form,
        phone: phoneE164,
        phoneDial: form.phoneDial,
        phoneLocal: normalizeLocalMobile(form.phoneLocal),
        phoneE164,
        phoneWa,
      });
      setRegistered(true);
    } catch {
      setError('تعذّر إرسال الطلب. تحقق من اتصالك وحاول مجدداً.');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setForm(emptyForm(stages[0]?.id, stages[0]?.labelAr, liveYear));
    setRegistered(false);
  };

  return (
    <div className="site-container">
      <section className="site-form">
        {!registered ? (
          <>
            <div className="site-section-kicker">طلب تسجيل جديد</div>
            <h1 style={{ fontSize: 'clamp(26px, 4.5vw, 36px)', marginBottom: 8 }}>طلب تسجيل</h1>
            <p className="site-section-lead">
              عبّئ البيانات أدناه. يلزم رقم واتساب ولي الأمر بمقدمة +970 أو +972.
            </p>
            <form className="card" style={{ gap: 16 }} onSubmit={onSubmit}>
              <div className="field">
                <label>اسم ولي الأمر</label>
                <input className="input" value={form.guardianName} onChange={set('guardianName')} required />
              </div>
              <PhoneWhatsAppField
                dialCode={form.phoneDial}
                localPhone={form.phoneLocal}
                onDialChange={(v) => setForm((f) => ({ ...f, phoneDial: v }))}
                onLocalChange={(v) => setForm((f) => ({ ...f, phoneLocal: v }))}
                required
              />
              <div className="field">
                <label>عنوان السكن</label>
                <input
                  className="input"
                  value={form.residentialAddress}
                  onChange={set('residentialAddress')}
                  required
                  placeholder="المدينة / الحي / الشارع…"
                />
              </div>
              <div className="site-grid-2">
                <div className="field">
                  <label>حالة العمل</label>
                  <select className="input" value={form.guardianWorkStatus} onChange={set('guardianWorkStatus')} required>
                    {GUARDIAN_WORK_STATUS_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>نوع السكن</label>
                  <select className="input" value={form.housingType} onChange={set('housingType')} required>
                    {HOUSING_TYPE_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>بيانات الطالب — الاسم الرباعي</div>
              <div className="site-grid-2">
                <div className="field"><label>الاسم الأول</label><input className="input" value={form.nameFirst} onChange={set('nameFirst')} required /></div>
                <div className="field"><label>اسم الأب</label><input className="input" value={form.nameFather} onChange={set('nameFather')} required /></div>
                <div className="field"><label>اسم الجد</label><input className="input" value={form.nameGrandfather} onChange={set('nameGrandfather')} required /></div>
                <div className="field"><label>العائلة</label><input className="input" value={form.nameFamily} onChange={set('nameFamily')} required /></div>
              </div>
              <div className="site-grid-3f">
                <div className="field"><label>رقم الهوية</label><input className="input" value={form.nationalId} onChange={set('nationalId')} required dir="ltr" style={{ textAlign: 'right' }} /></div>
                <div className="field"><label>العمر</label><input className="input" type="number" min="3" max="20" value={form.ageYears} onChange={set('ageYears')} dir="ltr" style={{ textAlign: 'right' }} /></div>
                <div className="field"><label>السنة الدراسية</label><input className="input" value={form.academicYear} onChange={set('academicYear')} /></div>
              </div>
              <div className="site-grid-2">
                <div className="field">
                  <label>المرحلة الدراسية</label>
                  <select className="input" value={form.stageId} onChange={onStageChange} required>
                    {stages.map((s) => <option key={s.id} value={s.id}>{s.labelAr}{s.ageRange ? ` — ${s.ageRange}` : ''}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>الشعبة المفضّلة</label>
                  <select className="input" value={form.classSection} onChange={set('classSection')}>
                    {SECTION_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="field">
                <label>طريقة التواصل المفضّلة</label>
                <div className="seg" style={{ marginTop: 2 }}>
                  {CONTACT_METHODS.map((m) => (
                    <label key={m} className="seg-opt">
                      <input type="radio" name="pref" checked={form.contactMethod === m} onChange={() => setForm((f) => ({ ...f, contactMethod: m }))} />
                      <span>{m}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="field"><label>ملاحظات (اختياري)</label><textarea className="input" placeholder="أي معلومة تودّ إخبارنا بها…" value={form.notes} onChange={set('notes')} /></div>
              <label className="radio"><input type="checkbox" checked={form.consent} onChange={set('consent')} /><span className="dot" /> أوافق على أن يتواصل معي مكتب القبول عبر واتساب/الهاتف</label>
              {error && <div style={{ fontSize: 13, color: 'var(--color-accent-2-700)' }}>{error}</div>}
              <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>{submitting ? 'جارٍ الإرسال…' : 'إرسال طلب التسجيل'}</button>
            </form>
          </>
        ) : (
          <div className="card" style={{ textAlign: 'center', alignItems: 'center', gap: 14, padding: '48px 24px', borderColor: 'var(--gold)' }}>
            <div style={{ width: 64, height: 64, border: '1px solid var(--gold)', borderRadius: '50%', display: 'grid', placeItems: 'center', color: 'var(--gold)' }}><Icon name="check" size={32} /></div>
            <h2 style={{ margin: 0 }}>تم استلام طلبك بنجاح</h2>
            <p style={{ color: 'var(--color-neutral-700)', maxWidth: 420, margin: 0 }}>شكراً لك. سيتواصل معك مكتب القبول على واتساب الرقم الذي سجّلته.</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button type="button" onClick={reset} className="btn btn-secondary">تسجيل طالب آخر</button>
              <button type="button" onClick={() => navigate('/site')} className="btn btn-primary">عودة للرئيسية</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
