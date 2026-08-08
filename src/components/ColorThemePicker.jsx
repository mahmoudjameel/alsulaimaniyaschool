import { useColorTheme } from '../context/FontThemeContext';

/**
 * Picker for school color themes (gold / blue-white / green).
 */
export default function ColorThemePicker({ value, onChange, showHints = true, compact = false }) {
  const { themes, activeId } = useColorTheme();
  const selected = value ?? activeId;

  return (
    <div className={`color-picker${compact ? ' color-picker--compact' : ''}`} role="radiogroup" aria-label="ثيم الألوان">
      {themes.map((t) => {
        const on = selected === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={on}
            className={`color-picker-card${on ? ' is-on' : ''}`}
            onClick={() => onChange(t.id)}
          >
            <div className="color-picker-swatches" aria-hidden="true">
              {t.swatches.map((c) => (
                <span key={c} className="color-picker-swatch" style={{ background: c }} />
              ))}
            </div>
            <div className="color-picker-name">{t.labelAr}</div>
            {showHints && !compact && (
              <div className="color-picker-hint">{t.hintAr}</div>
            )}
          </button>
        );
      })}
    </div>
  );
}
