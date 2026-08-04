import { Link } from 'react-router-dom';
import { orderBy } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { ErrorBanner } from '../../components/ui';
import { useMyChildren } from '../../hooks/useMyChildren';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { computeAttendanceRate } from '../../lib/attendance';
import { demoAttendanceRecords, demoStudentDetail, demoTeacherProfiles } from '../../data/demo';

export default function ParentProgress() {
  const { children, error } = useMyChildren();
  const { data: teachers } = useLiveOrDemo('teacherProfiles', [orderBy('name', 'asc')], demoTeacherProfiles);

  return (
    <div className="stu-page">
      <ErrorBanner>{error && 'تعذّر تحميل بيانات الأبناء.'}</ErrorBanner>
      <header className="stu-page-head">
        <h1 className="stu-page-title">التقدّم الدراسي</h1>
        <p className="stu-page-lead">صفوف أبنائك، نسبة الحضور، وكشف العلامات.</p>
      </header>

      <div className="stu-actions-row">
        <Link to="/parent/grades" className="btn btn-secondary" style={{ fontSize: 13, textDecoration: 'none' }}>الدرجات التفصيلية</Link>
        <Link to="/parent/attendance" className="btn btn-secondary" style={{ fontSize: 13, textDecoration: 'none' }}>سجل الحضور</Link>
      </div>

      {children.length === 0 && (
        <div className="card stu-empty-card">
          <Icon name="trending_up" size={28} color="var(--gold)" />
          <p>لا أبناء مرتبطون.</p>
        </div>
      )}

      {children.map((c) => (
        <ChildProgressCard key={c.id} child={c} teachers={teachers || []} />
      ))}
    </div>
  );
}

function ChildProgressCard({ child, teachers }) {
  const { data: classes, demo } = useLiveOrDemo(
    child.id ? `students/${child.id}/classes` : '__none__',
    [orderBy('createdAt', 'asc')],
    (demoStudentDetail[child.id] || demoStudentDetail.s1)?.classes || [],
    child.id,
  );
  const { data: attendance } = useLiveOrDemo(
    child.id ? `students/${child.id}/attendanceRecords` : '__none__',
    [orderBy('date', 'desc')],
    demoAttendanceRecords[child.id] || [],
    child.id,
  );
  const attendanceRate = computeAttendanceRate(attendance);

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div className="card-title" style={{ flex: 1, margin: 0 }}>
          {child.name}{' '}
          <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--color-neutral-500)' }}>· {child.grade}</span>
        </div>
        {attendanceRate != null && <span className="tag tag-accent">حضور {attendanceRate}%</span>}
        {child.id && (
          <Link to={`/parent/report-card/${child.id}`} className="btn btn-ghost" style={{ fontSize: 12, textDecoration: 'none' }}>
            <Icon name="description" size={13} /> كشف العلامات
          </Link>
        )}
      </div>
      {(classes || []).length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
          {(classes || []).map((cl) => {
            const teacher = teachers.find((t) => t.id === cl.teacherId);
            return (
              <div key={cl.id || cl.classId} className="stu-class-row">
                <div className="stu-class-icon"><Icon name="menu_book" size={16} /></div>
                <div className="stu-class-body">
                  <div className="stu-class-name">{cl.title || cl.className}</div>
                  <div className="stu-class-meta">
                    {[cl.subject, cl.teacher || teacher?.name, cl.shift ? `دوام ${cl.shift}` : ''].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <span className="tag tag-accent">{cl.grade || '—'}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="stu-empty" style={{ marginTop: 8 }}>
          {demo
            ? (child.progress != null ? `تقدّم الدروس: ${child.progress}%` : 'لا بيانات بعد.')
            : 'الطالب غير مسجّل في أي صف بعد.'}
        </p>
      )}
    </div>
  );
}
