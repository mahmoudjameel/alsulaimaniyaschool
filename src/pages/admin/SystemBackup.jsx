import { useState } from 'react';
import Icon from '../../components/Icon';
import { ErrorBanner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import {
  WIPE_CONFIRM_PHRASE,
  downloadJsonFile,
  exportSystemBackup,
  importSystemBackup,
  wipeSystemData,
} from '../../services/systemBackup';

function formatCounts(counts = {}) {
  return Object.entries(counts)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k}: ${n}`)
    .join(' · ');
}

export default function SystemBackup() {
  const { isFirebaseConfigured } = useAuth();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [exportMeta, setExportMeta] = useState(null);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [defaultPassword, setDefaultPassword] = useState('');
  const [wipeBeforeImport, setWipeBeforeImport] = useState(true);
  const [wipeConfirm, setWipeConfirm] = useState('');
  const [importResult, setImportResult] = useState(null);

  const runExport = async () => {
    if (!isFirebaseConfigured) {
      setError('اربط Firebase أولاً (وضع العرض التوضيحي لا يدعم النسخ الاحتياطي).');
      return;
    }
    setBusy('export');
    setError('');
    setMessage('');
    setExportMeta(null);
    try {
      const data = await exportSystemBackup();
      setExportMeta(data.meta || null);
      if (data.mode === 'inline' && data.backup) {
        downloadJsonFile(data.fileName || 'backup.json', data.backup);
        setMessage('تم تنزيل ملف النسخة الاحتياطية على جهازك.');
      } else if (data.mode === 'url' && data.downloadUrl) {
        const a = document.createElement('a');
        a.href = data.downloadUrl;
        a.download = data.fileName || 'backup.json';
        a.target = '_blank';
        a.rel = 'noreferrer';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setMessage('تم تجهيز رابط التنزيل (صالح ساعة واحدةً). احفظ الملف في مكان آمن.');
      } else {
        setError('استجابة تصدير غير متوقعة.');
      }
    } catch (err) {
      setError(err?.message || 'تعذّر التصدير.');
    } finally {
      setBusy('');
    }
  };

  const onPickImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setImportResult(null);
    setImportPreview(null);
    setImportFile(null);
    setError('');
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (parsed.kind !== 'alsulaimaniya-system-backup') {
        setError('هذا الملف ليس نسخة احتياطية من نظام السليمانية.');
        return;
      }
      setImportFile(parsed);
      setImportPreview(parsed.meta || countLocal(parsed));
    } catch {
      setError('تعذّر قراءة ملف JSON.');
    }
  };

  const runImport = async () => {
    if (!importFile) {
      setError('اختر ملف النسخة أولاً.');
      return;
    }
    if (wipeBeforeImport && wipeConfirm.trim() !== WIPE_CONFIRM_PHRASE) {
      setError(`للتأكيد اكتب: ${WIPE_CONFIRM_PHRASE}`);
      return;
    }
    if (!isFirebaseConfigured) {
      setError('اربط Firebase أولاً.');
      return;
    }
    setBusy('import');
    setError('');
    setMessage('');
    setImportResult(null);
    try {
      const res = await importSystemBackup({
        backup: importFile,
        defaultPassword: defaultPassword.trim() || undefined,
        wipeBeforeImport,
        confirmWipe: wipeBeforeImport ? wipeConfirm.trim() : undefined,
      });
      setImportResult(res);
      setMessage(res.noteAr || 'تمت الاستعادة.');
      if (res.createdPasswords?.length) {
        downloadJsonFile(
          `restored-passwords-${new Date().toISOString().slice(0, 10)}.json`,
          { createdAt: new Date().toISOString(), passwords: res.createdPasswords }
        );
      }
    } catch (err) {
      setError(err?.message || 'تعذّر الاستيراد.');
    } finally {
      setBusy('');
    }
  };

  const runWipe = async () => {
    if (wipeConfirm.trim() !== WIPE_CONFIRM_PHRASE) {
      setError(`للتأكيد اكتب: ${WIPE_CONFIRM_PHRASE}`);
      return;
    }
    if (!isFirebaseConfigured) {
      setError('اربط Firebase أولاً.');
      return;
    }
    const ok = window.confirm('سيتم حذف كل الطلاب والمعلمين والفواتير وكل البيانات. حسابك الإداري يبقى فقط. هل أنت متأكد؟');
    if (!ok) return;
    setBusy('wipe');
    setError('');
    setMessage('');
    try {
      const res = await wipeSystemData(wipeConfirm.trim());
      setMessage(res.noteAr || 'تم المسح.');
      setWipeConfirm('');
    } catch (err) {
      setError(err?.message || 'تعذّر المسح.');
    } finally {
      setBusy('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 820 }}>
      <div className="card-kicker">نسخ احتياطي كامل للنظام · استيراد · مسح للبدء من جديد</div>
      <ErrorBanner>{error}</ErrorBanner>
      {message && (
        <div className="card" style={{ borderColor: 'color-mix(in srgb, var(--gold) 40%, var(--line))', background: 'var(--color-accent-100)' }}>
          {message}
        </div>
      )}

      <section className="card" style={{ gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="download" size={18} color="var(--gold)" />
          <h2 style={{ margin: 0, fontSize: 18 }}>تصدير نسخة احتياطية</h2>
        </div>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: 'var(--color-neutral-700)' }}>
          يصدّر الطلاب، المعلّمين، الموظفين، الفواتير، الرواتب، الصفوف، أولياء الأمور، حسابات الدخول، والمحتوى.
          <strong> Firebase لا يسمح بتصدير كلمات المرور</strong> — عند الاستيراد تُعيَّن كلمات جديدة (تختارها أنت أو تُولَّد تلقائياً وتُنزَّل في ملف).
        </p>
        <button type="button" className="btn btn-primary" disabled={!!busy} onClick={runExport}>
          {busy === 'export' ? 'جاري التصدير…' : 'تنزيل النسخة الاحتياطية'}
        </button>
        {exportMeta && (
          <div style={{ fontSize: 12, color: 'var(--color-neutral-600)', lineHeight: 1.6 }}>
            {exportMeta.totalDocs} مستند · {exportMeta.authUserCount} حساب دخول
            <div style={{ marginTop: 4 }}>{formatCounts(exportMeta.counts)}</div>
          </div>
        )}
      </section>

      <section className="card" style={{ gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="upload" size={18} color="var(--gold)" />
          <h2 style={{ margin: 0, fontSize: 18 }}>استيراد نسخة احتياطية</h2>
        </div>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: 'var(--color-neutral-700)' }}>
          ارفع ملف JSON المُصدَّر سابقاً. يُفضَّل المسح قبل الاستيراد حتى لا تختلط البيانات القديمة مع الجديدة.
        </p>
        <label className="btn btn-secondary" style={{ width: 'fit-content', cursor: 'pointer' }}>
          اختيار ملف النسخة
          <input type="file" accept="application/json,.json" hidden onChange={onPickImport} />
        </label>
        {importPreview && (
          <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', lineHeight: 1.6 }}>
            جاهز للاستيراد: {importPreview.totalDocs ?? '—'} مستند
            {importPreview.authUserCount != null ? ` · ${importPreview.authUserCount} حساب` : ''}
            <div style={{ fontSize: 12, color: 'var(--color-neutral-500)', marginTop: 4 }}>
              {formatCounts(importPreview.counts)}
            </div>
          </div>
        )}
        <div style={{ display: 'grid', gap: 10 }}>
          <label style={{ fontSize: 13, display: 'grid', gap: 6 }}>
            كلمة مرور افتراضية للحسابات المُعاد إنشاؤها (اختياري — 6 أحرف فأكثر)
            <input
              className="input"
              type="text"
              dir="ltr"
              style={{ textAlign: 'right' }}
              placeholder="Passw0rd!"
              value={defaultPassword}
              onChange={(e) => setDefaultPassword(e.target.value)}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={wipeBeforeImport} onChange={(e) => setWipeBeforeImport(e.target.checked)} />
            امسح البيانات الحالية قبل الاستيراد
          </label>
        </div>
        <button type="button" className="btn btn-primary" disabled={!!busy || !importFile} onClick={runImport}>
          {busy === 'import' ? 'جاري الاستيراد…' : 'استيراد النسخة'}
        </button>
        {importResult?.createdPasswords?.length > 0 && (
          <div style={{ fontSize: 13 }}>
            أُنشئ {importResult.createdPasswords.length} حساب بكلمات مرور جديدة — نُزّل ملف كلمات المرور تلقائياً.
          </div>
        )}
      </section>

      <section className="card" style={{ gap: 12, borderColor: 'color-mix(in srgb, #b33 35%, var(--line))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="delete_forever" size={18} color="#a33" />
          <h2 style={{ margin: 0, fontSize: 18, color: '#8a2a2a' }}>مسح كل البيانات</h2>
        </div>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: 'var(--color-neutral-700)' }}>
          يحذف الطلاب والمعلّمين والفواتير والرواتب والصفوف وكل المجموعات، ويحذف حسابات الدخول ما عدا حسابك الإداري الحالي.
          استخدمه للبدء ببيانات حقيقية بعد أخذ نسخة احتياطية.
        </p>
        <label style={{ fontSize: 13, display: 'grid', gap: 6 }}>
          للتأكيد اكتب: <strong dir="ltr">{WIPE_CONFIRM_PHRASE}</strong>
          <input
            className="input"
            value={wipeConfirm}
            onChange={(e) => setWipeConfirm(e.target.value)}
            placeholder={WIPE_CONFIRM_PHRASE}
            dir="rtl"
          />
        </label>
        <button
          type="button"
          className="btn"
          style={{ borderColor: '#a33', color: '#a33' }}
          disabled={!!busy}
          onClick={runWipe}
        >
          {busy === 'wipe' ? 'جاري المسح…' : 'مسح كل بيانات النظام'}
        </button>
      </section>
    </div>
  );
}

function countLocal(backup) {
  const counts = {};
  let totalDocs = 0;
  for (const [name, docs] of Object.entries(backup.collections || {})) {
    const n = Object.keys(docs || {}).length;
    counts[name] = n;
    totalDocs += n;
  }
  return {
    counts,
    totalDocs,
    authUserCount: (backup.authUsers || []).length,
  };
}
