import { orderBy, where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { ErrorBanner } from '../../components/ui';
import { filterParentAnnouncements, useMyChildren } from '../../hooks/useMyChildren';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { relativeFromTimestamp } from '../../lib/relativeTime';
import { demoAnnouncements } from '../../data/demo';

export default function ParentAnnouncements() {
  const { children, error: childErr } = useMyChildren();
  const { data, error } = useLiveOrDemo(
    'announcements',
    [where('status', '==', 'منشور'), orderBy('createdAt', 'desc')],
    demoAnnouncements.filter((a) => a.status === 'منشور'),
  );
  const list = filterParentAnnouncements(data, children);

  return (
    <div className="stu-page">
      <ErrorBanner>{(error || childErr) && 'تعذّر تحميل الإعلانات.'}</ErrorBanner>
      <header className="stu-page-head">
        <h1 className="stu-page-title">الإعلانات</h1>
        <p className="stu-page-lead">إعلانات موجّهة لأولياء الأمور أو صفوف أبنائك.</p>
      </header>

      {list.length === 0 && (
        <div className="card stu-empty-card">
          <Icon name="campaign" size={28} color="var(--gold)" />
          <p>لا إعلانات منشورة حالياً.</p>
        </div>
      )}

      {list.map((a) => (
        <article key={a.id} className="card">
          <div className="stu-announcement-head">
            <span className="tag tag-outline">{a.audience || 'الجميع'}</span>
            <span className="stu-feed-time" style={{ marginInlineStart: 'auto' }}>
              {a.date || relativeFromTimestamp(a.createdAt)}
            </span>
          </div>
          <h2 className="stu-announcement-title">{a.title}</h2>
          {(a.body || a.content || a.text) && (
            <p className="stu-announcement-body">{a.body || a.content || a.text}</p>
          )}
        </article>
      ))}
    </div>
  );
}
