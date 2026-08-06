import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { EmptyRow, ErrorBanner } from '../../components/ui';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { useMyStudent } from '../../hooks/useMyStudent';
import { useAcademicYearLabel } from '../../components/AcademicYearText';
import {
  CONTINUOUS_TYPES,
  assessmentTypeLabel,
  isContinuousType,
  scoreToBand,
} from '../../services/grades';
import { demoGradeEntries } from '../../data/demo';

function GradesTable({ rows, emptyLabel }) {
  return (
    <table className="table">
      <thead>
        <tr>
          <th>التقييم</th>
          <th>النوع</th>
          <th>المادة</th>
          <th>الدرجة</th>
          <th>التقدير</th>
          <th>الفصل</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && <EmptyRow colSpan={6}>{emptyLabel}</EmptyRow>}
        {rows.map((g) => (
          <tr key={g.id}>
            <td style={{ fontWeight: 600 }}>{g.assessmentTitle || 'تقييم'}</td>
            <td style={{ fontSize: 12 }}>{assessmentTypeLabel(g.assessmentType) || '—'}</td>
            <td>{g.subject || g.className || '—'}</td>
            <td className="ah-tabnum">{g.score}/{g.maxScore}</td>
            <td>{scoreToBand(g.score, g.maxScore)}</td>
            <td style={{ fontSize: 12 }}>{g.term || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function StudentGrades() {
  const { studentId, displayName, error: stuErr, demo } = useMyStudent();
  const { academicYear } = useAcademicYearLabel();
  const { data: grades, error } = useLiveOrDemo(
    'gradeEntries',
    [where('studentId', '==', studentId || '__none__')],
    demoGradeEntries.filter((g) => g.studentId === 's1'),
    studentId || '__none__',
  );
  const approved = useMemo(() => (grades || []).filter((g) => g.status === 'معتمد'), [grades]);
  const continuous = useMemo(
    () => approved.filter((g) => isContinuousType(g.assessmentType)),
    [approved],
  );
  const exams = useMemo(
    () => approved.filter((g) => !isContinuousType(g.assessmentType)),
    [approved],
  );
  const pending = (grades || []).filter((g) => g.status === 'قيد المراجعة');

  const continuousByType = useMemo(() => {
    return CONTINUOUS_TYPES.map((type) => ({
      type,
      label: assessmentTypeLabel(type),
      rows: continuous.filter((g) => g.assessmentType === type),
    }));
  }, [continuous]);

  return (
    <div className="stu-page">
      <ErrorBanner>{(stuErr || error) && 'تعذّر تحميل الدرجات.'}</ErrorBanner>
      <header className="stu-page-head">
        <h1 className="stu-page-title">درجاتي</h1>
        <p className="stu-page-lead">
          درجات الدفتر والحضور والنشاط والاختبارات المعتمدة للعام {academicYear} — {displayName}
        </p>
      </header>

      <div className="stu-actions-row">
        <Link to={`/student/report-card/${studentId || 's1'}`} className="btn btn-primary" style={{ fontSize: 13, textDecoration: 'none' }}>
          <Icon name="description" size={15} /> كشف العلامات / بطاقة التقرير
        </Link>
        <Link to="/student/achievements" className="btn btn-secondary" style={{ fontSize: 13, textDecoration: 'none' }}>
          تقدّمي وإنجازاتي
        </Link>
      </div>

      {pending.length > 0 && (
        <div className="card" style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>
          لديك {pending.length} درجة بانتظار اعتماد الإدارة — ستظهر هنا عند الاعتماد.
        </div>
      )}

      <section className="card ah-table-wrap" style={{ padding: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
          <h2 className="card-title" style={{ margin: 0 }}>درجات مستمرة · دفتر / حضور / نشاط · {continuous.length}</h2>
        </div>
        {continuous.length === 0 ? (
          <div style={{ padding: 16, fontSize: 13, color: 'var(--color-neutral-500)' }}>لا درجات مستمرة معتمدة بعد.</div>
        ) : (
          continuousByType.filter((b) => b.rows.length > 0).map((b) => (
            <div key={b.type}>
              <div style={{ padding: '10px 16px', fontSize: 13, fontWeight: 700, background: 'color-mix(in srgb, var(--color-neutral-100) 80%, transparent)' }}>
                {b.label} · {b.rows.length}
              </div>
              <GradesTable rows={b.rows} emptyLabel="—" />
            </div>
          ))
        )}
      </section>

      <section className="card ah-table-wrap" style={{ padding: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
          <h2 className="card-title" style={{ margin: 0 }}>اختبارات وفرض · {exams.length}</h2>
        </div>
        <GradesTable rows={exams} emptyLabel="لا درجات اختبارات معتمدة بعد." />
      </section>
    </div>
  );
}
