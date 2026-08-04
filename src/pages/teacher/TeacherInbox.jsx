import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { orderBy, where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { EmptyRow, ErrorBanner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { relativeFromTimestamp } from '../../lib/relativeTime';
import { markNotificationRead, markNotificationsRead } from '../../services/notifications';

export default function TeacherInbox() {
  const { profile } = useAuth();
  const [busy, setBusy] = useState(false);
  const { data, error, demo } = useLiveOrDemo(
    'notifications',
    [where('userId', '==', profile?.id || '__none__'), orderBy('createdAt', 'desc')],
    [],
    profile?.id,
  );

  const unread = useMemo(() => (data || []).filter((n) => !n.read), [data]);

  const markAll = async () => {
    if (demo || unread.length === 0) return;
    setBusy(true);
    try {
      await markNotificationsRead(unread.map((n) => n.id));
    } finally {
      setBusy(false);
    }
  };

  const onOpen = async (n) => {
    if (!demo && !n.read) {
      try { await markNotificationRead(n.id); } catch { /* ignore */ }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ErrorBanner>{error && 'تعذّر تحميل الإشعارات.'}</ErrorBanner>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)', flex: 1, lineHeight: 1.7 }}>
          درجات اعتُمدت أو رُفضت، تبريرات غياب من أولياء الأمور، وتنبيهات الإدارة عن طلابك.
          {demo ? ' (عرض توضيحي)' : ''}
        </p>
        <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} disabled={busy || unread.length === 0} onClick={markAll}>
          تعليم الكل كمقروء ({unread.length})
        </button>
      </div>

      <div className="card ah-table-wrap" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>الإشعار</th>
              <th>الطالب</th>
              <th>الوقت</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(data || []).length === 0 && <EmptyRow colSpan={4}>لا إشعارات بعد.</EmptyRow>}
            {(data || []).map((n) => (
              <tr key={n.id} style={{ background: n.read ? undefined : 'color-mix(in srgb, var(--color-accent-100) 55%, transparent)' }}>
                <td>
                  <div style={{ fontWeight: n.read ? 500 : 700 }}>{n.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-neutral-600)', marginTop: 2 }}>{n.body}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-neutral-500)', marginTop: 2 }}>{n.type}</div>
                </td>
                <td>{n.studentName || '—'}</td>
                <td style={{ fontSize: 12 }}>{relativeFromTimestamp(n.createdAt) || '—'}</td>
                <td style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>
                  {n.link ? (
                    <Link to={n.link} className="btn btn-ghost" style={{ fontSize: 12, textDecoration: 'none' }} onClick={() => onOpen(n)}>
                      فتح
                    </Link>
                  ) : (
                    <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => onOpen(n)}>
                      <Icon name="done" size={14} /> مقروء
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
