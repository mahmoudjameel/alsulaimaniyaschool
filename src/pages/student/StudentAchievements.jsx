import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { orderBy, where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { ErrorBanner } from '../../components/ui';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { useMyStudent } from '../../hooks/useMyStudent';
import { useAcademicYearLabel } from '../../components/AcademicYearText';
import { computeAttendanceRate } from '../../lib/attendance';
import { demoAttendanceRecords, demoGradeEntries } from '../../data/demo';

export default function StudentAchievements() {
  const { studentId, error, demo } = useMyStudent();
  const { academicYear } = useAcademicYearLabel();

  const { data: gradesLive } = useLiveOrDemo(
    'gradeEntries',
    [where('studentId', '==', studentId || '__none__')],
    demoGradeEntries.filter((g) => g.studentId === 's1'),
    studentId || '__none__',
  );
  const grades = useMemo(() => (gradesLive || []).filter((g) => g.status === 'معتمد'), [gradesLive]);

  const { data: attendance } = useLiveOrDemo(
    `students/${studentId || '__none__'}/attendanceRecords`,
    [orderBy('date', 'asc')],
    demoAttendanceRecords.s1 || [],
    studentId || '__none__',
  );
  const attendPct = computeAttendanceRate(attendance);

  const milestones = useMemo(() => {
    const items = [];
    items.push({ icon: 'grade', label: 'أول درجة معتمدة', done: grades.length >= 1 });
    items.push({ icon: 'workspace_premium', label: 'ثلاث درجات معتمدة', done: grades.length >= 3 });
    items.push({ icon: 'event_available', label: 'مواظبة ≥ 90٪', done: attendPct != null && attendPct >= 90 });
    items.push({ icon: 'menu_book', label: 'متابعة الصفوف', done: true });
    return items;
  }, [grades.length, attendPct]);

  const avgPct = useMemo(() => {
    const withMax = grades.filter((g) => g.maxScore > 0 && g.score != null);
    if (!withMax.length) return null;
    const sum = withMax.reduce((s, g) => s + (Number(g.score) / Number(g.maxScore)) * 100, 0);
    return Math.round(sum / withMax.length);
  }, [grades]);

  return (
    <div className="stu-page">
      <ErrorBanner>{error && 'تعذّر تحميل بيانات التقدّم.'}</ErrorBanner>
      <header className="stu-page-head">
        <h1 className="stu-page-title">تقدّمي الدراسي</h1>
        <p className="stu-page-lead">ملخصك للعام {academicYear} — بدون مقارنة علنية مع زملائك.</p>
      </header>

      <div className="stu-actions-row">
        <Link to="/student/grades" className="btn btn-primary" style={{ fontSize: 13, textDecoration: 'none' }}>الدرجات</Link>
        <Link to="/student/attendance" className="btn btn-secondary" style={{ fontSize: 13, textDecoration: 'none' }}>الحضور</Link>
        <Link to={`/student/report-card/${studentId || 's1'}`} className="btn btn-ghost" style={{ fontSize: 13, textDecoration: 'none' }}>كشف العلامات</Link>
      </div>

      <div className="stu-hero-stats stu-hero-stats--wide">
        <div className="stu-stat">
          <span className="stu-stat-val">{grades.length}</span>
          <span className="stu-stat-lbl">درجات معتمدة</span>
        </div>
        <div className="stu-stat">
          <span className="stu-stat-val">{avgPct != null ? `${avgPct}%` : '—'}</span>
          <span className="stu-stat-lbl">متوسط النسبة</span>
        </div>
        <div className="stu-stat">
          <span className="stu-stat-val">{attendPct != null ? `${attendPct}%` : '—'}</span>
          <span className="stu-stat-lbl">الحضور</span>
        </div>
      </div>

      <section className="card">
        <h2 className="card-title" style={{ marginBottom: 12 }}>إنجازاتي</h2>
        <div className="stu-milestones">
          {milestones.map((m) => (
            <div key={m.label} className={`stu-milestone ${m.done ? 'is-done' : ''}`}>
              <div className="stu-milestone-icon">
                <Icon name={m.icon} size={22} color={m.done ? 'var(--gold)' : 'var(--color-neutral-400)'} />
              </div>
              <span>{m.label}</span>
              {m.done
                ? <Icon name="check_circle" size={18} color="var(--color-accent-700)" />
                : <span className="stu-class-meta">قريباً</span>}
            </div>
          ))}
        </div>
      </section>
      {demo && <p className="stu-class-meta">وضع العرض التوضيحي.</p>}
    </div>
  );
}
