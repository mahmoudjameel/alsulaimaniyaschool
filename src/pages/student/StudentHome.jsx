import { Link } from 'react-router-dom';
import { orderBy, where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { ErrorBanner } from '../../components/ui';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { filterStudentAnnouncements, useMyStudent } from '../../hooks/useMyStudent';
import { formatILS } from '../../lib/constants';
import { relativeFromTimestamp, relativeHoursAr } from '../../lib/relativeTime';
import {
  demoAnnouncements,
  demoGradeEntries,
  demoStudentClasses,
} from '../../data/demo';

export default function StudentHome() {
  const {
    student, studentId, enrolled, error: studentErr, demo, displayName, displayId, gradeLabel,
  } = useMyStudent();

  const enrolledView = demo
    ? demoStudentClasses.map((c, i) => ({
      id: `demo-c-${i}`,
      className: c.title,
      subject: c.subject,
    }))
    : enrolled;

  const { data: gradesLive } = useLiveOrDemo(
    'gradeEntries',
    [where('studentId', '==', studentId || '__none__')],
    demoGradeEntries.filter((g) => g.studentId === 's1'),
    studentId || '__none__',
  );
  const grades = (gradesLive || [])
    .filter((g) => g.status === 'معتمد')
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
    .slice(0, 4);

  const { data: announcementsRaw } = useLiveOrDemo(
    'announcements',
    [where('status', '==', 'منشور'), orderBy('createdAt', 'desc')],
    demoAnnouncements.filter((a) => a.status === 'منشور'),
  );
  const announcements = filterStudentAnnouncements(announcementsRaw, student).slice(0, 3);

  const balance = Number(student?.balanceMinorUnits || 0);
  const metaLine = [gradeLabel, displayId].filter(Boolean).join(' · ');

  return (
    <div className="stu-page">
      <ErrorBanner>{studentErr && 'تعذّر تحميل ملفك.'}</ErrorBanner>

      <header className="stu-home-head">
        <h1 className="stu-hello">{displayName}</h1>
        {metaLine && <p className="stu-hello-sub">{metaLine}</p>}
      </header>

      <Link to="/student/today" className="stu-banner">
        <div>
          <div className="stu-banner-label">اليوم</div>
          <div className="stu-banner-title">جدولك ودفتر المعلّم</div>
        </div>
        <Icon name="chevron_left" size={22} color="var(--gold)" />
      </Link>

      <nav className="stu-pill-row" aria-label="اختصارات">
        <Link to="/student/grades" className="stu-pill">درجاتي</Link>
        <Link to="/student/homework" className="stu-pill">واجباتي</Link>
        <Link to="/student/attendance" className="stu-pill">حضوري</Link>
        <Link to="/student/classes" className="stu-pill">صفوفي</Link>
      </nav>

      {balance > 0 && (
        <Link to="/student/fees" className="stu-notice">
          <span>مستحقات: {formatILS(balance)}</span>
          <span className="stu-notice-link">التفاصيل</span>
        </Link>
      )}

      <section>
        <div className="stu-section-head">
          <h2 className="stu-section-title">آخر الدرجات</h2>
          <Link to="/student/grades" className="stu-section-link">الكل</Link>
        </div>
        {grades.length === 0 ? (
          <p className="stu-empty">ما في درجات معتمدة بعد.</p>
        ) : (
          <div className="stu-list">
            {grades.map((g) => (
              <div key={g.id} className="stu-list-row">
                <div className="stu-list-main">
                  <div className="stu-list-title">{g.assessmentTitle || 'تقييم'}</div>
                  <div className="stu-list-sub">{[g.subject, g.assessmentType].filter(Boolean).join(' · ')}</div>
                </div>
                <div className="stu-list-side ah-tabnum">{g.score}/{g.maxScore}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="stu-section-head">
          <h2 className="stu-section-title">صفوفي</h2>
          <Link to="/student/classes" className="stu-section-link">الكل</Link>
        </div>
        {enrolledView.length === 0 ? (
          <p className="stu-empty">ما انضمّيت لصفوف بعد.</p>
        ) : (
          <div className="stu-list">
            {enrolledView.slice(0, 4).map((c) => (
              <div key={c.id || c.className} className="stu-list-row">
                <div className="stu-list-main">
                  <div className="stu-list-title">{c.className || c.title}</div>
                  <div className="stu-list-sub">{c.subject || '—'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="stu-section-head">
          <h2 className="stu-section-title">إعلانات</h2>
          <Link to="/student/announcements" className="stu-section-link">المزيد</Link>
        </div>
        {announcements.length === 0 ? (
          <p className="stu-empty">ما في إعلانات حالياً.</p>
        ) : (
          <div className="stu-list">
            {announcements.map((a, i) => (
              <div key={a.id || i} className="stu-list-row">
                <div className="stu-list-main">
                  <div className="stu-list-title">{a.title}</div>
                </div>
                <span className="stu-list-time">
                  {a.hoursAgo != null ? relativeHoursAr(a.hoursAgo) : relativeFromTimestamp(a.createdAt) || a.date}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
