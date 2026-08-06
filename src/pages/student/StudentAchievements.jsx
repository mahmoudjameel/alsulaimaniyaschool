import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { orderBy, where } from 'firebase/firestore';
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

  const avgPct = useMemo(() => {
    const withMax = grades.filter((g) => g.maxScore > 0 && g.score != null);
    if (!withMax.length) return null;
    const sum = withMax.reduce((s, g) => s + (Number(g.score) / Number(g.maxScore)) * 100, 0);
    return Math.round(sum / withMax.length);
  }, [grades]);

  return (
    <div className="stu-page">
      <ErrorBanner>{error && 'تعذّر تحميل التقدّم.'}</ErrorBanner>

      <header className="stu-page-head">
        <h1 className="stu-page-title">تقدّمي</h1>
        <p className="stu-page-lead">ملخص العام {academicYear}</p>
      </header>

      <div className="stu-summary">
        <div className="stu-summary-item">
          <span className="stu-summary-val">{grades.length}</span>
          <span className="stu-summary-lbl">درجات</span>
        </div>
        <div className="stu-summary-item">
          <span className="stu-summary-val">{avgPct != null ? `${avgPct}%` : '—'}</span>
          <span className="stu-summary-lbl">المتوسط</span>
        </div>
        <div className="stu-summary-item">
          <span className="stu-summary-val">{attendPct != null ? `${attendPct}%` : '—'}</span>
          <span className="stu-summary-lbl">الحضور</span>
        </div>
      </div>

      <div className="stu-foot-links">
        <Link to="/student/grades">الدرجات</Link>
        <Link to="/student/attendance">الحضور</Link>
        <Link to={`/student/report-card/${studentId || 's1'}`}>كشف العلامات</Link>
      </div>

      {demo && <p className="stu-list-sub">عرض توضيحي</p>}
    </div>
  );
}
