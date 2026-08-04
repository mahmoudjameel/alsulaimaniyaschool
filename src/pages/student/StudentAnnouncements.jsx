import { orderBy } from 'firebase/firestore';
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
    [orderBy('createdAt', 'desc')],
    demoAnnouncements,
  );
  const list = filterStudentAnnouncements(raw, student);

  return (
    <div className="stu-page">
      <ErrorBanner>{(stuErr || error) && 'تعذّر تحميل الإعلانات.'}</ErrorBanner>
      <header className="stu-page-head">
        <h1 className="stu-page-title">إعلاناتي</h1>
        <p className="stu-page-lead">إعلانات موجّهة للطلاب أو للجميع أو لمرحلتك الدراسية.</p>
      </header>

      {list.length === 0 && (
        <div className="card stu-empty-card">
          <Icon name="campaign" size={28} color="var(--gold)" />
          <p>لا إعلانات مناسبة لك حالياً.</p>
        </div>
      )}

      {list.map((a, i) => (
        <article key={a.id || i} className="card stu-announcement">
          <div className="stu-announcement-head">
            <span className="tag tag-outline">{a.audience || 'الجميع'}</span>
            <span className="stu-feed-time">
              {a.date || relativeFromTimestamp(a.createdAt) || ''}
            </span>
          </div>
          <h2 className="stu-announcement-title">{a.title}</h2>
          {a.body && <p className="stu-announcement-body">{a.body}</p>}
        </article>
      ))}
    </div>
  );
}
