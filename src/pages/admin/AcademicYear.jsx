import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import BackButton from '../../components/BackButton';
import Icon from '../../components/Icon';
import { Field } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useAcademicCalendar } from '../../hooks/useAcademicCalendar';
import { useAcademicStages } from '../../hooks/useAcademicStages';
import {
  ACADEMIC_TERMS,
  buildRolloverPlan,
  countPendingGradesForTerm,
  fetchAllStudentsForRollover,
  runYearRollover,
  saveAcademicCalendar,
  setTermClosed,
} from '../../services/academicCalendar';
import { isFirebaseConfigured } from '../../firebase/config';

function formatRolloverStamp(ts) {
  if (!ts) return null;
  try {
    const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return null;
  }
}

export default function AcademicYear() {
  const { profile } = useAuth();
  const { calendar, loading } = useAcademicCalendar();
  const { stages } = useAcademicStages();

  const [yearDraft, setYearDraft] = useState('');
  const [termDraft, setTermDraft] = useState(ACADEMIC_TERMS[0]);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');
  const [settingsErr, setSettingsErr] = useState('');

  const [lockTerm, setLockTerm] = useState(ACADEMIC_TERMS[0]);
  const [pendingCount, setPendingCount] = useState(null);
  const [lockBusy, setLockBusy] = useState(false);
  const [lockMsg, setLockMsg] = useState('');
  const [lockErr, setLockErr] = useState('');

  const [newYear, setNewYear] = useState('');
  const [confirmYear, setConfirmYear] = useState('');
  const [clearEnrollments, setClearEnrollments] = useState(true);
  const [plan, setPlan] = useState(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  const [rolloverMsg, setRolloverMsg] = useState('');
  const [rolloverErr, setRolloverErr] = useState('');

  useEffect(() => {
    setYearDraft(calendar.academicYear || '');
    setTermDraft(calendar.activeTerm || ACADEMIC_TERMS[0]);
  }, [calendar.academicYear, calendar.activeTerm]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isFirebaseConfigured) {
        setPendingCount(0);
        return;
      }
      try {
        const n = await countPendingGradesForTerm(lockTerm);
        if (!cancelled) setPendingCount(n);
      } catch {
        if (!cancelled) setPendingCount(null);
      }
    })();
    return () => { cancelled = true; };
  }, [lockTerm, calendar.closedTerms]);

  const actor = useMemo(() => ({
    uid: profile?.id,
    name: profile?.name,
    role: profile?.role || 'admin',
  }), [profile]);

  const lastRolloverLabel = formatRolloverStamp(calendar.lastRolloverAt);

  const onSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsMsg('');
    setSettingsErr('');
    try {
      await saveAcademicCalendar({
        academicYear: yearDraft.trim(),
        activeTerm: termDraft,
      }, actor);
      setSettingsMsg('سُجّل إعداد العام والفصل النشط.');
    } catch {
      setSettingsErr('تعذّر الحفظ. تحقق من الصلاحيات.');
    } finally {
      setSavingSettings(false);
    }
  };

  const onCloseTerm = async () => {
    setLockBusy(true);
    setLockMsg('');
    setLockErr('');
    try {
      await setTermClosed(lockTerm, true, actor);
      setLockMsg(`أُغلق «${lockTerm}» وقُفل إدخال درجاته.`);
    } catch {
      setLockErr('تعذّر إغلاق الفصل.');
    } finally {
      setLockBusy(false);
    }
  };

  const onReopenTerm = async () => {
    setLockBusy(true);
    setLockMsg('');
    setLockErr('');
    try {
      await setTermClosed(lockTerm, false, actor);
      setLockMsg(`أُعيد فتح إدخال درجات «${lockTerm}».`);
    } catch {
      setLockErr('تعذّر إعادة الفتح.');
    } finally {
      setLockBusy(false);
    }
  };

  const onPreview = async () => {
    setPreviewBusy(true);
    setRolloverMsg('');
    setRolloverErr('');
    setPlan(null);
    try {
      const year = newYear.trim();
      if (!year) {
        setRolloverErr('أدخل السنة الدراسية الجديدة.');
        return;
      }
      if (year === calendar.academicYear) {
        setRolloverErr('السنة الجديدة مطابقة للسنة الحالية. غيّرها أولاً.');
        return;
      }
      const students = await fetchAllStudentsForRollover();
      setPlan(buildRolloverPlan(students, stages, year));
    } catch {
      setRolloverErr('تعذّر بناء المعاينة. تحقق من الاتصال.');
    } finally {
      setPreviewBusy(false);
    }
  };

  const onApplyRollover = async () => {
    if (!plan) return;
    if (confirmYear.trim() !== plan.newAcademicYear) {
      setRolloverErr(`للتأكيد اكتب السنة الجديدة حرفياً: ${plan.newAcademicYear}`);
      return;
    }
    setApplyBusy(true);
    setRolloverMsg('');
    setRolloverErr('');
    try {
      const summary = await runYearRollover({
        plan,
        clearEnrollments,
        actor,
      });
      setRolloverMsg(
        `تم الترحيل إلى ${plan.newAcademicYear}: ترقية ${summary.promoted} · تخرج ${summary.graduated}`
        + (clearEnrollments ? ` · تفريغ تسجيلات ${summary.unenrolled}` : '')
        + (summary.errors.length ? ` · أخطاء ${summary.errors.length}` : '')
        + '.',
      );
      setPlan(null);
      setConfirmYear('');
      setNewYear('');
    } catch {
      setRolloverErr('تعذّر تنفيذ الترحيل. راجع الصلاحيات أو أعد المحاولة.');
    } finally {
      setApplyBusy(false);
    }
  };

  const termLocked = calendar.closedTerms.includes(lockTerm);

  if (loading && !calendar.academicYear) {
    return <div className="card">جارٍ التحميل…</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 820 }}>
      <BackButton to="/admin" label="عودة للوحة القيادة" />

      <div>
        <div className="card-kicker">الشؤون الأكاديمية</div>
        <h2 style={{ margin: '4px 0 8px', fontSize: 24 }}>العام الدراسي والترحيل</h2>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-600)', lineHeight: 1.75 }}>
          ضبط السنة والفصل، إغلاق الفصل بعد الاعتماد، وترحيل الطلاب إلى العام التالي.
          {' '}
          قبل أي ترحيل: نزّل نسخة احتياطية من{' '}
          <Link to="/admin/backup" style={{ color: 'var(--gold)' }}>نسخ احتياطي ومسح</Link>.
        </p>
      </div>

      <form className="card" onSubmit={onSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="card-title" style={{ margin: 0 }}>إعداد العام</div>
        <div className="site-grid-2">
          <Field label="العام الدراسي الحالي">
            <input
              className="input"
              value={yearDraft}
              onChange={(e) => setYearDraft(e.target.value)}
              placeholder="مثال: 2026 / 2027"
              required
            />
          </Field>
          <Field label="الفصل النشط">
            <select className="input" value={termDraft} onChange={(e) => setTermDraft(e.target.value)}>
              {ACADEMIC_TERMS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>
        {(settingsErr || settingsMsg) && (
          <div style={{ fontSize: 13, color: settingsErr ? 'var(--color-accent-2-700)' : 'var(--color-accent-800)' }}>
            {settingsErr || settingsMsg}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="submit" className="btn btn-primary" disabled={savingSettings}>
            {savingSettings ? 'جارٍ الحفظ…' : 'حفظ الإعداد'}
          </button>
          <Link to="/admin/grades" className="btn btn-ghost" style={{ textDecoration: 'none', fontSize: 13 }}>
            اعتماد الدرجات
          </Link>
        </div>
      </form>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="card-title" style={{ margin: 0 }}>إغلاق الفصل</div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-neutral-600)', lineHeight: 1.7 }}>
          بعد اعتماد درجات الفصل، أغلِقْه لمنع إدخال درجات جديدة عليه. يمكن إعادة الفتح عند الحاجة.
        </p>
        <Field label="الفصل">
          <select className="input" value={lockTerm} onChange={(e) => setLockTerm(e.target.value)} style={{ maxWidth: 280 }}>
            {ACADEMIC_TERMS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>
        <div style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>
          الحالة:{' '}
          <strong>{termLocked ? 'مقفل' : 'مفتوح للإدخال'}</strong>
          {pendingCount != null && (
            <>
              {' · '}درجات قيد المراجعة لهذا الفصل:{' '}
              <strong className="ah-tabnum">{pendingCount}</strong>
              {pendingCount > 0 && (
                <>
                  {' — '}
                  <Link to="/admin/grades" style={{ color: 'var(--gold)' }}>راجع الاعتماد</Link>
                </>
              )}
            </>
          )}
        </div>
        {calendar.closedTerms.length > 0 && (
          <div style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>
            الفصول المقفلة حالياً: {calendar.closedTerms.join(' · ')}
          </div>
        )}
        {(lockErr || lockMsg) && (
          <div style={{ fontSize: 13, color: lockErr ? 'var(--color-accent-2-700)' : 'var(--color-accent-800)' }}>
            {lockErr || lockMsg}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={lockBusy || termLocked}
            onClick={onCloseTerm}
          >
            <Icon name="lock" size={15} /> {lockBusy ? 'جارٍ…' : 'إغلاق وقفل الإدخال'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={lockBusy || !termLocked}
            onClick={onReopenTerm}
          >
            إعادة فتح الفصل
          </button>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="card-title" style={{ margin: 0 }}>ترحيل نهاية العام</div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-neutral-600)', lineHeight: 1.7 }}>
          ترقية الطلاب النشطين حسب ترتيب المراحل، وتخرج آخر مرحلة، وتحديث السنة.
          التسجيل في الصفوف يُفرَّغ افتراضياً — أعد التسجيل من{' '}
          <Link to="/admin/enrollment" style={{ color: 'var(--gold)' }}>تسجيل الطلاب في الصفوف</Link>
          {' '}بعد الترحيل.
        </p>
        {lastRolloverLabel && (
          <div style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>
            آخر ترحيل: {lastRolloverLabel}
            {calendar.lastRolloverByName ? ` · ${calendar.lastRolloverByName}` : ''}
            {calendar.lastRolloverSummary
              ? ` · ترقية ${calendar.lastRolloverSummary.promoted || 0} / تخرج ${calendar.lastRolloverSummary.graduated || 0}`
              : ''}
          </div>
        )}
        <div className="site-grid-2">
          <Field label="السنة الدراسية الجديدة">
            <input
              className="input"
              value={newYear}
              onChange={(e) => { setNewYear(e.target.value); setPlan(null); }}
              placeholder="مثال: 2027 / 2028"
            />
          </Field>
          <Field label="السنة الحالية (للمقارنة)">
            <input className="input" value={calendar.academicYear} disabled />
          </Field>
        </div>
        <label className="radio" style={{ alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={clearEnrollments}
            onChange={(e) => setClearEnrollments(e.target.checked)}
          />
          <span className="dot" /> تفريغ تسجيل الطلاب من الصفوف عند الترحيل
        </label>
        <div>
          <button type="button" className="btn btn-secondary" disabled={previewBusy} onClick={onPreview}>
            {previewBusy ? 'جارٍ المعاينة…' : 'معاينة الترحيل'}
          </button>
        </div>

        {plan && (
          <div style={{
            border: '1px solid var(--line)',
            borderRadius: 12,
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            background: 'var(--color-neutral-50)',
          }}
          >
            <div style={{ fontWeight: 600 }}>معاينة — إلى {plan.newAcademicYear}</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
              <span>ترقية: <strong className="ah-tabnum">{plan.totals.promote}</strong></span>
              <span>تخرج: <strong className="ah-tabnum">{plan.totals.graduate}</strong></span>
              <span>تخطي: <strong className="ah-tabnum">{plan.totals.skipped}</strong></span>
            </div>
            {plan.promote.length > 0 && (
              <details>
                <summary style={{ cursor: 'pointer', fontSize: 13 }}>قائمة الترقية</summary>
                <ul style={{ margin: '8px 0 0', paddingInlineStart: 20, fontSize: 12, lineHeight: 1.7, maxHeight: 160, overflow: 'auto' }}>
                  {plan.promote.slice(0, 80).map((r) => (
                    <li key={r.id}>{r.name}: {r.fromLabel} ← {r.toLabel}</li>
                  ))}
                  {plan.promote.length > 80 && <li>… و{plan.promote.length - 80} آخرون</li>}
                </ul>
              </details>
            )}
            {plan.graduate.length > 0 && (
              <details>
                <summary style={{ cursor: 'pointer', fontSize: 13 }}>قائمة التخرج</summary>
                <ul style={{ margin: '8px 0 0', paddingInlineStart: 20, fontSize: 12, lineHeight: 1.7, maxHeight: 120, overflow: 'auto' }}>
                  {plan.graduate.slice(0, 40).map((r) => (
                    <li key={r.id}>{r.name} ({r.fromLabel})</li>
                  ))}
                </ul>
              </details>
            )}
            {plan.skipped.length > 0 && (
              <details>
                <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--color-accent-2-700)' }}>تخطي — يحتاج مراجعة يدوية</summary>
                <ul style={{ margin: '8px 0 0', paddingInlineStart: 20, fontSize: 12, lineHeight: 1.7 }}>
                  {plan.skipped.map((r) => (
                    <li key={r.id}>{r.name}: {r.reason}</li>
                  ))}
                </ul>
              </details>
            )}
            <Field label={`للتأكيد اكتب السنة الجديدة: ${plan.newAcademicYear}`}>
              <input
                className="input"
                value={confirmYear}
                onChange={(e) => setConfirmYear(e.target.value)}
                placeholder={plan.newAcademicYear}
              />
            </Field>
            <button
              type="button"
              className="btn btn-primary"
              disabled={applyBusy || confirmYear.trim() !== plan.newAcademicYear}
              onClick={onApplyRollover}
            >
              {applyBusy ? 'جارٍ الترحيل…' : 'تنفيذ الترحيل'}
            </button>
          </div>
        )}

        {(rolloverErr || rolloverMsg) && (
          <div style={{ fontSize: 13, color: rolloverErr ? 'var(--color-accent-2-700)' : 'var(--color-accent-800)' }}>
            {rolloverErr || rolloverMsg}
          </div>
        )}
      </div>
    </div>
  );
}
