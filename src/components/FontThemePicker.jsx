import { useFontTheme } from '../context/FontThemeContext';

/**
 * Visual picker for the 4 school font themes.
 * @param {{ value?: string, onChange: (id: string) => void, showHints?: boolean, compact?: boolean }} props
 */
export default function FontThemePicker({ value, onChange, showHints = true, compact = false }) {
  const { themes, activeId } = useFontTheme();
  const selected = value ?? activeId;

  return (
    <div className={`font-picker${compact ? ' font-picker--compact' : ''}`} role="radiogroup" aria-label="نوع الخط">
      {themes.map((t) => {
        const on = selected === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={on}
            className={`font-picker-card${on ? ' is-on' : ''}`}
            onClick={() => onChange(t.id)}
            style={{ fontFamily: t.body }}
          >
            <div className="font-picker-name" style={{ fontFamily: t.heading }}>{t.labelAr}</div>
            <div className="font-picker-sample" style={{ fontFamily: t.heading }}>{t.sample}</div>
            {showHints && !compact && (
              <div className="font-picker-hint">{t.hintAr}</div>
            )}
          </button>
        );
      })}
    </div>
  );
}
