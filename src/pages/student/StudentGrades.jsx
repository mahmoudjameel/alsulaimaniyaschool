import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { ErrorBanner } from '../../components/ui';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { useMyStudent } from '../../hooks/useMyStudent';
import { useAcademicYearLabel } from '../../components/AcademicYearText';
import {
  assessmentTypeLabel,
  filterByAcademicYear,
  isContinuousType,
  scoreToBand,
} from '../../services/grades';
import { demoGradeEntries } from '../../data/demo';

const FILTERS = [
  { id: 'all', label: 'الكل' },
  { id: 'continuous', label: 'مستمرة' },
  { id: 'exams', label: 'اختبارات' },
];

export default function StudentGrades() {
  const { studentId, error: stuErr, demo } = useMyStudent();
  const { academicYear } = useAcademicYearLabel();
  const [filter, setFilter] = useState('all');

  const { data: grades, error } = useLiveOrDemo(
    'gradeEntries',
    [where('studentId', '==', studentId || '__none__')],
    demoGradeEntries.filter((g) => g.studentId === 's1'),
    studentId || '__none__',
  );

  const approved = useMemo(() => {
    const rows = filterByAcademicYear(
      (grades || []).filter((g) => g.status === 'معتمد'),
      academicYear,
    );
    return [...rows].sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() || a.decidedAt?.toMillis?.() || 0;
      const tb = b.createdAt?.toMillis?.() || b.decidedAt?.toMillis?.() || 0;
      return tb - ta;
    });
  }, [grades, academicYear]);

  const pending = (grades || []).filter((g) => g.status === 'قيد المراجعة').length;

  const view = useMemo(() => {
    if (filter === 'continuous') return approved.filter((g) => isContinuousType(g.assessmentType));
    if (filter === 'exams') return approved.filter((g) => !isContinuousType(g.assessmentType));
    return approved;
  }, [approved, filter]);

  return (
    <div className="stu-page">
      <ErrorBanner>{(stuErr || error) && 'تعذّر تحميل الدرجات.'}</ErrorBanner>

      <header className="stu-page-head">
        <h1 className="stu-page-title">درجاتي</h1>
        <p className="stu-page-lead">العام {academicYear} · الأحدث أولاً</p>
      </header>

      <div className="stu-filter" role="tablist" aria-label="نوع الدرجة">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            className={`stu-filter-btn${filter === f.id ? ' is-on' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {pending > 0 && (
        <p className="stu-hint">{pending} درجة بانتظار اعتماد الإدارة.</p>
      )}

      {view.length === 0 ? (
        <div className="stu-empty-block">
          <p>ما في درجات هنا بعد.</p>
        </div>
      ) : (
        <div className="stu-list">
          {view.map((g) => (
            <div key={g.id} className="stu-list-row stu-list-row--grade">
              <div className="stu-list-main">
                <div className="stu-list-title">{g.assessmentTitle || 'تقييم'}</div>
                <div className="stu-list-sub">
                  {[
                    assessmentTypeLabel(g.assessmentType) || g.assessmentType,
                    g.subject || g.className,
                    g.term,
                  ].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div className="stu-grade-cell">
                <span className="stu-list-side ah-tabnum">{g.score}/{g.maxScore}</span>
                <span className="stu-list-sub">{scoreToBand(g.score, g.maxScore)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="stu-foot-links">
        <Link to={`/student/report-card/${studentId || 's1'}`}>
          <Icon name="description" size={15} /> كشف العلامات
        </Link>
      </div>
    </div>
  );
}
