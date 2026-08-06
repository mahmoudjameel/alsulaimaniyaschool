import { Link } from 'react-router-dom';
import { orderBy, where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { ErrorBanner } from '../../components/ui';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { filterStudentAnnouncements, useMyStudent } from '../../hooks/useMyStudent';
import { formatILS } from '../../lib/constants';
import { useAcademicYearLabel } from '../../components/AcademicYearText';
import { relativeFromTimestamp, relativeHoursAr } from '../../lib/relativeTime';
import {
  demoAnnouncements,
  demoGradeEntries,
  demoStudentClasses,
} from '../../data/demo';

const QUICK = [
  { to: '/student/today', icon: 'today', label: 'اليوم' },
  { to: '/student/grades', icon: 'grade', label: 'الدرجات' },
  { to: '/student/attendance', icon: 'event_available', label: 'الحضور' },
  { to: '/student/homework', icon: 'assignment', label: 'واجبات' },
  { to: '/student/fees', icon: 'payments', label: 'المستحقات' },
  { to: '/student/inbox', icon: 'notifications', label: 'تنبيهات' },
  { to: '/student/notes', icon: 'chat', label: 'ملاحظات' },
  { to: '/student/announcements', icon: 'campaign', label: 'إعلانات' },
];

export default function StudentHome() {
  const {
    profile, student, studentId, enrolled, error: studentErr, demo, displayName, displayId, gradeLabel,
  } = useMyStudent();
  const { academicYear } = useAcademicYearLabel();

  const enrolledView = demo
    ? demoStudentClasses.map((c, i) => ({
      id: `demo-c-${i}`,
      className: c.title,
      subject: c.subject,
      progress: c.progress,
      nextLesson: c.next,
    }))
    : enrolled;

  const { data: gradesLive } = useLiveOrDemo(
    'gradeEntries',
    [where('studentId', '==', studentId || '__none__')],
    demoGradeEntries.filter((g) => g.studentId === 's1'),
    studentId || '__none__',
  );
  const grades = (gradesLive || []).filter((g) => g.status === 'معتمد').slice(0, 5);

  const { data: announcementsRaw } = useLiveOrDemo(
    'announcements',
    [where('status', '==', 'منشور'), orderBy('createdAt', 'desc')],
    demoAnnouncements.filter((a) => a.status === 'منشور'),
  );
  const announcements = filterStudentAnnouncements(announcementsRaw, student);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'صباح الخير';
    if (h < 17) return 'مرحباً';
    return 'مساء الخير';
  })();

  const balance = Number(student?.balanceMinorUnits || 0);
  const firstClass = enrolledView[0];

  return (
    <div className="stu-page">
      <ErrorBanner>{studentErr && 'تعذّر تحميل ملفك الدراسي.'}</ErrorBanner>

      <section className="stu-hero">
        <div className="stu-hero-text">
          <p className="stu-kicker">{greeting}</p>
          <h1 className="stu-hello">{displayName}</h1>
          <p className="stu-hello-sub">
            {[gradeLabel, displayId, academicYear].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="stu-hero-stats">
          <div className="stu-stat">
            <span className="stu-stat-val">{enrolledView.length}</span>
            <span className="stu-stat-lbl">صفوف</span>
          </div>
          <div className="stu-stat">
            <span className="stu-stat-val">{grades.length}</span>
            <span className="stu-stat-lbl">درجات</span>
          </div>
          {balance > 0 && (
            <div className="stu-stat">
              <span className="stu-stat-val" style={{ fontSize: 16 }}>{formatILS(balance)}</span>
              <span className="stu-stat-lbl">مستحق</span>
            </div>
          )}
        </div>
      </section>

      <section className="stu-quick-grid">
        {QUICK.map((q) => (
          <Link key={q.to} to={q.to} className="stu-quick-item">
            <Icon name={q.icon} size={20} color="var(--gold)" />
            <span>{q.label}</span>
          </Link>
        ))}
      </section>

      {firstClass && (
        <Link to="/student/today" className="stu-continue card">
          <div>
            <div className="card-kicker">يومك الدراسي</div>
            <div className="stu-continue-title">{firstClass.className || firstClass.title}</div>
            <div className="card-meta" style={{ margin: 0 }}>
              جدول الحصص · دفتر اليوم · الواجبات والتنبيهات
            </div>
          </div>
          <span className="btn btn-primary" style={{ pointerEvents: 'none', fontSize: 13, whiteSpace: 'nowrap' }}>
            <Icon name="today" size={16} /> اليوم
          </span>
        </Link>
      )}

      <div className="stu-grid-2">
        <section className="card">
          <div className="stu-section-head">
            <h2 className="card-title" style={{ margin: 0 }}>صفوفي</h2>
            <Link to="/student/classes" className="ah-tablink" style={{ fontSize: 12, color: 'var(--gold)' }}>الكل</Link>
          </div>
          {enrolledView.length === 0 && <p className="stu-empty">لم تُسجَّل في صفوف بعد.</p>}
          {enrolledView.slice(0, 4).map((c) => (
            <div key={c.id || c.className} className="stu-class-row">
              <div className="stu-class-icon"><Icon name="menu_book" size={18} /></div>
              <div className="stu-class-body">
                <div className="stu-class-name">{c.className || c.title}</div>
                <div className="stu-class-meta">{c.subject || '—'}</div>
              </div>
            </div>
          ))}
        </section>

        <section className="card">
          <div className="stu-section-head">
            <h2 className="card-title" style={{ margin: 0 }}>آخر الدرجات</h2>
            <Link to="/student/grades" className="ah-tablink" style={{ fontSize: 12, color: 'var(--gold)' }}>الكل</Link>
          </div>
          {grades.length === 0 && <p className="stu-empty">لا درجات معتمدة بعد.</p>}
          {grades.map((g) => (
            <div key={g.id} className="stu-grade-row">
              <div>
                <div className="stu-class-name">{g.assessmentTitle || 'تقييم'}</div>
                <div className="stu-class-meta">{[g.assessmentType, g.subject].filter(Boolean).join(' · ')}</div>
              </div>
              <div className="stu-grade-score ah-tabnum">{g.score}/{g.maxScore}</div>
            </div>
          ))}
        </section>
      </div>

      <section className="card">
        <div className="stu-section-head">
          <h2 className="card-title" style={{ margin: 0 }}>إعلانات</h2>
          <Link to="/student/announcements" className="ah-tablink" style={{ fontSize: 12, color: 'var(--gold)' }}>المزيد</Link>
        </div>
        {announcements.length === 0 && <p className="stu-empty">لا إعلانات حالياً.</p>}
        {announcements.slice(0, 4).map((a, i) => (
          <div key={a.id || i} className="stu-feed-row">
            <div className="stu-feed-icon"><Icon name="campaign" size={16} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="stu-class-name">{a.title}</div>
            </div>
            <span className="stu-feed-time">
              {a.hoursAgo != null ? relativeHoursAr(a.hoursAgo) : relativeFromTimestamp(a.createdAt) || a.date}
            </span>
          </div>
        ))}
      </section>
      {profile?.displayId && <p className="stu-class-meta">الرقم الدراسي: {profile.displayId}</p>}
    </div>
  );
}
