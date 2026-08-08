import { useEffect, useState } from 'react';
import Icon from '../../components/Icon';
import FontThemePicker from '../../components/FontThemePicker';
import ColorThemePicker from '../../components/ColorThemePicker';
import { useAuth } from '../../context/AuthContext';
import { useAppearance } from '../../context/FontThemeContext';
import { useSchoolSite } from '../../hooks/useSchoolSite';
import { DEFAULT_FONT_THEME, applyFontThemeToDocument, getFontTheme } from '../../lib/fonts';
import { DEFAULT_COLOR_THEME, applyColorThemeToDocument, getColorTheme } from '../../lib/colorThemes';
import { saveAppearance } from '../../services/schoolSite';
import { logActivity } from '../../services/activity';

/**
 * Admin-only: school-wide font + color themes for the whole system.
 */
export default function Appearance() {
  const { profile } = useAuth();
  const { site, loading } = useSchoolSite();
  const { fontSchoolDefaultId, colorSchoolDefaultId } = useAppearance();

  const [fontDraft, setFontDraft] = useState(null);
  const [colorDraft, setColorDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fontCurrent = fontDraft ?? (site?.fontTheme || fontSchoolDefaultId || DEFAULT_FONT_THEME);
  const colorCurrent = colorDraft ?? (site?.colorTheme || colorSchoolDefaultId || DEFAULT_COLOR_THEME);
  const dirty = fontCurrent !== fontSchoolDefaultId || colorCurrent !== colorSchoolDefaultId;

  // Live preview while choosing
  useEffect(() => {
    applyFontThemeToDocument(fontCurrent);
    applyColorThemeToDocument(colorCurrent);
    return () => {
      applyFontThemeToDocument(fontSchoolDefaultId);
      applyColorThemeToDocument(colorSchoolDefaultId);
    };
  }, [fontCurrent, colorCurrent, fontSchoolDefaultId, colorSchoolDefaultId]);

  const onSave = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await saveAppearance(
        { fontTheme: fontCurrent, colorTheme: colorCurrent },
        { uid: profile?.id, name: profile?.name },
      );
      await logActivity({
        type: 'appearance_updated',
        actorUid: profile?.id,
        actorName: profile?.name,
        actorRole: profile?.role,
        summary: `مظهر النظام: خط «${getFontTheme(fontCurrent).labelAr}» · ألوان «${getColorTheme(colorCurrent).labelAr}»`,
        targetType: 'schoolSettings',
        targetId: 'main',
      }).catch(() => {});
      setFontDraft(null);
      setColorDraft(null);
      setMessage(`تم اعتماد المظهر للمدرسة: ${getFontTheme(fontCurrent).labelAr} · ${getColorTheme(colorCurrent).labelAr}`);
    } catch {
      setError('تعذّر الحفظ. تحقق من صلاحياتك.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !site) {
    return <div className="card">جارٍ التحميل…</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 760 }}>
      <header>
        <h2 style={{ margin: 0, fontSize: 22 }}>مظهر النظام</h2>
        <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--color-neutral-600)', lineHeight: 1.7 }}>
          اختر الخط والألوان ثم اعتمدها — تُطبَّق على كل البوابات والموقع.
        </p>
      </header>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 17 }}>ثيم الألوان</h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-neutral-500)' }}>
            يغيّر ألوان الواجهة بالكامل
          </p>
        </div>
        <ColorThemePicker value={colorCurrent} onChange={setColorDraft} />
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 17 }}>خط العرض</h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-neutral-500)' }}>
            أربعة خطوط عربية مناسبة للمدرسة
          </p>
        </div>
        <FontThemePicker value={fontCurrent} onChange={setFontDraft} />
      </section>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <button type="button" className="btn btn-primary" disabled={saving || !dirty} onClick={onSave}>
          <Icon name="save" size={16} />
          {saving ? 'جارٍ الحفظ…' : 'اعتماد للمدرسة'}
        </button>
      </div>

      {message && (
        <div style={{ fontSize: 13, color: 'var(--color-accent-700)', padding: '10px 12px', background: 'var(--color-accent-100)', borderRadius: 'var(--radius-md)' }}>
          {message}
        </div>
      )}
      {error && (
        <div style={{ fontSize: 13, color: 'var(--color-accent-2-800)', padding: '10px 12px', background: 'var(--color-accent-2-100)', borderRadius: 'var(--radius-md)' }}>
          {error}
        </div>
      )}

      <p style={{ margin: 0, fontSize: 12, color: 'var(--color-neutral-500)' }}>
        المعتمد الآن:{' '}
        <strong>{getColorTheme(colorSchoolDefaultId).labelAr}</strong>
        {' · '}
        <strong>{getFontTheme(fontSchoolDefaultId).labelAr}</strong>
      </p>
    </div>
  );
}
