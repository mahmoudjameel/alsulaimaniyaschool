import { useEffect, useRef } from 'react';
import { useAcademicCalendar } from '../hooks/useAcademicCalendar';
import { ACADEMIC_TERMS, isTermClosed } from '../services/academicCalendar';

/**
 * Shared term dropdown — marks closed terms.
 * disabledClosed: prevent selecting a locked term (teacher entry flows).
 * emptyLabel: label for empty option when allowEmpty (e.g. الكل / بدون فصل)
 */
export default function TermSelect({
  value,
  onChange,
  allowEmpty = false,
  emptyLabel = 'بدون فصل',
  disabledClosed = true,
  id,
  className = 'input',
  style,
}) {
  const { calendar } = useAcademicCalendar();
  const terms = allowEmpty ? [...ACADEMIC_TERMS, ''] : ACADEMIC_TERMS;

  return (
    <select
      id={id}
      className={className}
      style={style}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {terms.map((t) => {
        if (t === '') {
          return <option key="__empty" value="">{emptyLabel}</option>;
        }
        const locked = isTermClosed(calendar, t);
        return (
          <option key={t} value={t} disabled={disabledClosed && locked}>
            {locked ? `${t} (مقفل)` : t}
          </option>
        );
      })}
    </select>
  );
}

/** Once calendar loads, set term to activeTerm (first sync only). */
export function useDefaultActiveTerm(setTerm) {
  const { calendar, loading } = useAcademicCalendar();
  const synced = useRef(false);
  useEffect(() => {
    if (loading || synced.current) return;
    if (calendar.activeTerm && ACADEMIC_TERMS.includes(calendar.activeTerm)) {
      setTerm(calendar.activeTerm);
      synced.current = true;
    }
  }, [loading, calendar.activeTerm, setTerm]);
  return calendar;
}
