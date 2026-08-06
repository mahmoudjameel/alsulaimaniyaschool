import { orderBy, where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { ErrorBanner } from '../../components/ui';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { filterStudentAnnouncements, useMyStudent } from '../../hooks/useMyStudent';
import { relativeFromTimestamp } from '../../lib/relativeTime';
import { demoAnnouncements } from '../../data/demo';

export default function StudentAnnouncements() {
  const { student, error: stuErr } = useMyStudent();
  const { data: raw, error } = useLiveOrDemo(
    'announcements',
    [where('status', '==', 'منشور'), orderBy('createdAt', 'desc')],
    demoAnnouncements.filter((a) => a.status === 'منشور'),
  );
  const list = filterStudentAnnouncements(raw, student);

  return (
    <div className="stu-page">
      <ErrorBanner>{(stuErr || error) && 'تعذّر تحميل الإعلانات.'}</ErrorBanner>

      <header className="stu-page-head">
        <h1 className="stu-page-title">إعلانات</h1>
        <p className="stu-page-lead">الأحدث أولاً</p>
      </header>

      {list.length === 0 ? (
        <div className="stu-empty-block">
          <Icon name="campaign" size={28} color="var(--gold)" />
          <p>ما في إعلانات.</p>
        </div>
      ) : (
        <div className="stu-list">
          {list.map((a, i) => (
            <article key={a.id || i} className="stu-announce-card">
              <div className="stu-note-top">
                <span className="stu-list-sub">{a.audience || 'الجميع'}</span>
                <span className="stu-list-time">
                  {a.date || relativeFromTimestamp(a.createdAt) || ''}
                </span>
              </div>
              <h2 className="stu-list-title" style={{ fontSize: 16 }}>{a.title}</h2>
              {a.body && <p className="stu-note-text">{a.body}</p>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
