import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import BackButton from '../../components/BackButton';
import { Field } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useSchoolSite } from '../../hooks/useSchoolSite';
import { getDevicePosition } from '../../lib/geo';
import { saveSchoolSite } from '../../services/schoolSite';
import { logActivity } from '../../services/activity';

/**
 * Admin: configure school GPS center + geofence radius for teacher punches.
 */
export default function SchoolSite() {
  const { profile } = useAuth();
  const { site, loading } = useSchoolSite();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const f = form || site;
  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...(prev || site), [key]: value }));
  };

  const onUseMyLocation = async () => {
    setLocating(true);
    setError('');
    try {
      const pos = await getDevicePosition();
      setForm((prev) => ({
        ...(prev || site),
        latitude: Number(pos.lat.toFixed(6)),
        longitude: Number(pos.lng.toFixed(6)),
      }));
      setMessage(`تم التقاط الإحداثيات (دقة ${pos.accuracy ?? '?'} م). احفظ لاعتمادها.`);
    } catch {
      setError('تعذّر قراءة الموقع. اسمح بالوصول ثم أعد المحاولة من داخل الحرم.');
    } finally {
      setLocating(false);
    }
  };

  const onSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await saveSchoolSite(f, { uid: profile?.id, name: profile?.name });
      await logActivity({
        type: 'school_site_updated',
        actorUid: profile?.id,
        actorName: profile?.name,
        actorRole: profile?.role,
        summary: `تحديث موقع التسجيل المعتمد · نطاق ${f.radiusMeters} م`,
        targetType: 'schoolSettings',
        targetId: 'main',
      }).catch(() => {});
      setForm(null);
      setMessage('سُجّل موقع التسجيل ونطاقه في السجل الرسمي.');
    } catch (err) {
      if (err?.message === 'INVALID_RADIUS') setError('نصف القطر بين 30 و 2000 متر فقط.');
      else if (err?.message === 'INVALID_COORDS') setError('أدخل إحداثيات صحيحة.');
      else setError('تعذّر الحفظ. تحقق من صلاحياتك.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !site) {
    return <div className="card">جارٍ التحميل…</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 720 }}>
      <BackButton to="/admin" label="عودة للوحة القيادة" />

      <div>
        <div className="card-kicker">لوحة التحكم</div>
        <h2 style={{ margin: '4px 0 8px', fontSize: 24 }}>موقع التسجيل المعتمد</h2>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-600)', lineHeight: 1.7 }}>
          اعتماد إحداثيات حرم المدرسة ونطاق التسجيل. لا يُقبل حضور أو انصراف خارج هذا النطاق.
        </p>
      </div>

      <div className="card" style={{ background: 'var(--color-neutral-50)' }}>
        <div className="card-title" style={{ marginBottom: 10, fontSize: 15 }}>آلية العمل</div>
        <ol style={{ margin: 0, paddingInlineStart: 22, fontSize: 13, lineHeight: 1.85, color: 'var(--color-neutral-700)' }}>
          <li>ضبط خط العرض والطول ونصف القطر هنا، أو التقاط الموقع من داخل الحرم ثم الحفظ.</li>
          <li>الموظف يفتح بوابته على الجهاز ويسمح بتحديد الموقع قبل التسجيل.</li>
          <li><strong>تسجيل حضور</strong> عند الدخول — تُثبَّت الساعة والمسافة عن المركز.</li>
          <li><strong>تسجيل انصراف</strong> عند المغادرة — يُغلق سجلّ اليوم.</li>
          <li>المتابعة من{' '}
            <Link to="/admin/staff-attendance" style={{ color: 'var(--gold)' }}>حضور الموظفين</Link>
            {' '}حسب الدور، مع تحديث أيام الحضور في الرواتب عند ربط سجلّ الموظف.
          </li>
        </ol>
      </div>

      <form className="card" onSubmit={onSave} style={{ gap: 14, display: 'flex', flexDirection: 'column' }}>
        <Field label="اسم الموقع">
          <input className="input" value={f.nameAr || ''} onChange={set('nameAr')} required />
        </Field>
        <Field label="وصف العنوان">
          <input className="input" value={f.locationLabelAr || ''} onChange={set('locationLabelAr')} />
        </Field>
        <div className="site-grid-2">
          <Field label="خط العرض (Latitude)">
            <input
              className="input"
              type="number"
              step="0.000001"
              dir="ltr"
              style={{ textAlign: 'right' }}
              value={f.latitude ?? ''}
              onChange={set('latitude')}
              required
            />
          </Field>
          <Field label="خط الطول (Longitude)">
            <input
              className="input"
              type="number"
              step="0.000001"
              dir="ltr"
              style={{ textAlign: 'right' }}
              value={f.longitude ?? ''}
              onChange={set('longitude')}
              required
            />
          </Field>
        </div>
        <div className="site-grid-3f">
          <Field label="نصف قطر النطاق (متر)">
            <input
              className="input"
              type="number"
              min="30"
              max="2000"
              dir="ltr"
              style={{ textAlign: 'right' }}
              value={f.radiusMeters ?? 200}
              onChange={set('radiusMeters')}
              required
            />
          </Field>
          <Field label="بداية الدوام الرسمي">
            <input className="input" type="time" value={f.workdayStart || '07:30'} onChange={set('workdayStart')} dir="ltr" />
          </Field>
          <Field label="نهاية الدوام الرسمي">
            <input className="input" type="time" value={f.workdayEnd || '14:00'} onChange={set('workdayEnd')} dir="ltr" />
          </Field>
        </div>
        <label className="radio" style={{ alignItems: 'center' }}>
          <input type="checkbox" checked={f.punchEnabled !== false} onChange={set('punchEnabled')} />
          <span className="dot" /> تفعيل تسجيل الحضور والانصراف (هيئة تدريسية · مالية · استقبال)
        </label>
        <Field label="ملاحظات داخلية (اختياري)">
          <textarea className="input" rows={2} value={f.notes || ''} onChange={set('notes')} placeholder="مثال: البوابة الرئيسية — المبنى الغربي" />
        </Field>

        {(error || message) && (
          <div style={{ fontSize: 13, color: error ? 'var(--color-accent-2-700)' : 'var(--color-accent-800)' }}>
            {error || message}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" disabled={locating} onClick={onUseMyLocation}>
            <Icon name="my_location" size={15} /> {locating ? 'جارٍ التحديد…' : 'التقاط موقعي الحالي'}
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'جارٍ الحفظ…' : 'حفظ إعدادات الموقع'}
          </button>
          <Link to="/admin/staff-attendance" className="btn btn-ghost" style={{ textDecoration: 'none', fontSize: 13 }}>
            متابعة حضور الموظفين
          </Link>
        </div>
      </form>
    </div>
  );
}
