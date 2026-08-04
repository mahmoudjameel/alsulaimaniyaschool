import { Link } from 'react-router-dom';
import { orderBy, where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { EmptyRow, ErrorBanner } from '../../components/ui';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { useMyStudent } from '../../hooks/useMyStudent';
import { CURRENT_ACADEMIC_YEAR } from '../../lib/constants';
import { scoreToBand } from '../../services/grades';
import { demoGradeEntries } from '../../data/demo';

export default function StudentGrades() {
  const { studentId, displayName, error: stuErr, demo } = useMyStudent();
  const { data: grades, error } = useLiveOrDemo(
    'gradeEntries',
    [where('studentId', '==', studentId || '__none__')],
    demoGradeEntries.filter((g) => g.studentId === 's1'),
    studentId || '__none__',
  );
  const approved = (grades || []).filter((g) => g.status === 'معتمد');
  const pending = (grades || []).filter((g) => g.status === 'قيد المراجعة');

  return (
    <div className="stu-page">
      <ErrorBanner>{(stuErr || error) && 'تعذّر تحميل الدرجات.'}</ErrorBanner>
      <header className="stu-page-head">
        <h1 className="stu-page-title">درجاتي</h1>
        <p className="stu-page-lead">الدرجات المعتمدة (امتحان شهري / نصف فصل / نهاية فصل…) للعام {CURRENT_ACADEMIC_YEAR} — {displayName}</p>
      </header>

      <div className="stu-actions-row">
        <Link to={`/student/report-card/${studentId || 's1'}`} className="btn btn-primary" style={{ fontSize: 13, textDecoration: 'none' }}>
          <Icon name="description" size={15} /> كشف العلامات / بطاقة التقرير
        </Link>
        <Link to="/student/achievements" className="btn btn-secondary" style={{ fontSize: 13, textDecoration: 'none' }}>
          تقدّمي وإنجازاتي
        </Link>
      </div>

      <section className="card ah-table-wrap" style={{ padding: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
          <h2 className="card-title" style={{ margin: 0 }}>الدرجات المعتمدة · {approved.length}</h2>
        </div>
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
            {approved.length === 0 && <EmptyRow colSpan={6}>لا درجات معتمدة بعد.</EmptyRow>}
            {approved.map((g) => {
              const pct = g.maxScore ? Math.round((Number(g.score) / Number(g.maxScore)) * 100) : null;
              return (
                <tr key={g.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{g.assessmentTitle || 'تقييم'}</div>
                    <div className="stu-class-meta">{g.className || ''}</div>
                  </td>
                  <td style={{ fontSize: 12 }}>{g.assessmentType || '—'}</td>
                  <td>{g.subject || '—'}</td>
                  <td className="ah-tabnum" style={{ fontWeight: 700 }}>{g.score}/{g.maxScore}{pct != null ? ` (${pct}%)` : ''}</td>
                  <td><span className="tag tag-accent">{scoreToBand(g.score, g.maxScore)}</span></td>
                  <td>{g.term || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {pending.length > 0 && (
        <section className="card">
          <h2 className="card-title" style={{ marginBottom: 8 }}>قيد المراجعة · {pending.length}</h2>
          <p className="stu-empty">رُصدت هذه الدرجات من المعلّم وما زالت بانتظار اعتماد الإدارة — لن تظهر في كشف العلامات حتى تُعتمد.</p>
        </section>
      )}
      {demo && <p className="stu-class-meta">وضع العرض التوضيحي.</p>}
    </div>
  );
}
