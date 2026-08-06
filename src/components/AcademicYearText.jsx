import { useAcademicCalendar } from '../hooks/useAcademicCalendar';
import { CURRENT_ACADEMIC_YEAR } from '../lib/constants';

/** Live academic year string from school settings (constant fallback). */
export function useAcademicYearLabel() {
  const { calendar, loading } = useAcademicCalendar();
  return {
    academicYear: calendar?.academicYear || CURRENT_ACADEMIC_YEAR,
    activeTerm: calendar?.activeTerm,
    closedTerms: calendar?.closedTerms || [],
    loading,
    calendar,
  };
}

/** Inline text: العام الدراسي 2026 / 2027 */
export default function AcademicYearText({ prefix = 'العام الدراسي', as: Tag = 'span', className, style }) {
  const { academicYear } = useAcademicYearLabel();
  return (
    <Tag className={className} style={style}>
      {prefix ? `${prefix} ${academicYear}` : academicYear}
    </Tag>
  );
}
