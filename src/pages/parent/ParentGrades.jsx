import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { where } from 'firebase/firestore';
import ChildSwitcher from '../../components/ChildSwitcher';
import Icon from '../../components/Icon';
import { EmptyRow, ErrorBanner } from '../../components/ui';
import { useMyChildren } from '../../hooks/useMyChildren';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { useAcademicYearLabel } from '../../components/AcademicYearText';
import { assessmentTypeLabel, scoreToBand } from '../../services/grades';
import { demoGradeEntries } from '../../data/demo';

export default function ParentGrades() {
  const { children, error: childErr, demo } = useMyChildren();
  const { academicYear } = useAcademicYearLabel();
  const [selectedId, setSelectedId] = useState(children[0]?.id || '');

  useEffect(() => {
    if (children.length && !children.some((c) => c.id === selectedId)) {
      setSelectedId(children[0].id);
    }
  }, [children, selectedId]);

  const activeId = selectedId || children[0]?.id;
  const active = children.find((c) => c.id === activeId) || children[0];

  const { data: grades, error } = useLiveOrDemo(
    'gradeEntries',
    [where('studentId', '==', activeId || '__none__')],
    demoGradeEntries.filter((g) => g.studentId === (activeId || 's1')),
    activeId || '__none__',
  );
  const approved = (grades || []).filter((g) => g.status === 'معتمد');

  return (
    <div className="stu-page">
      <ErrorBanner>{(childErr || error) && 'تعذّر تحميل الدرجات.'}</ErrorBanner>
      <header className="stu-page-head">
        <h1 className="stu-page-title">درجات الأبناء</h1>
        <p className="stu-page-lead">الدرجات المعتمدة للعام {academicYear}</p>
      </header>

      <ChildSwitcher children={children} selectedId={activeId} onChange={setSelectedId} />

      {!active && (
        <div className="card stu-empty-card">
          <Icon name="grade" size={28} color="var(--gold)" />
          <p>لا أبناء مرتبطون.</p>
        </div>
      )}

      {active && (
        <>
          <div className="stu-actions-row">
            <Link to={`/parent/report-card/${active.id}`} className="btn btn-primary" style={{ fontSize: 13, textDecoration: 'none' }}>
              <Icon name="description" size={15} /> كشف علامات {active.name}
            </Link>
          </div>

          <section className="card ah-table-wrap" style={{ padding: 0 }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
              <h2 className="card-title" style={{ margin: 0 }}>{active.name} · معتمد {approved.length}</h2>
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
                      <td style={{ fontSize: 12 }}>{assessmentTypeLabel(g.assessmentType) || '—'}</td>
                      <td>{g.subject || '—'}</td>
                      <td className="ah-tabnum" style={{ fontWeight: 700 }}>
                        {g.score}/{g.maxScore}{pct != null ? ` (${pct}%)` : ''}
                      </td>
                      <td><span className="tag tag-accent">{scoreToBand(g.score, g.maxScore)}</span></td>
                      <td>{g.term || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
          {demo && <p className="stu-class-meta">وضع العرض التوضيحي.</p>}
        </>
      )}
    </div>
  );
}
