import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { orderBy, where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { ErrorBanner } from '../../components/ui';
import { filterParentAnnouncements, useMyChildren } from '../../hooks/useMyChildren';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { relativeFromTimestamp } from '../../lib/relativeTime';
import { demoAnnouncements, demoPaymentProofs, demoStudentDetail } from '../../data/demo';

export default function ParentInbox() {
  const { profile, children, error, demo } = useMyChildren();

  const { data: announcementsRaw } = useLiveOrDemo(
    'announcements',
    [where('status', '==', 'منشور'), orderBy('createdAt', 'desc')],
    demoAnnouncements.filter((a) => a.status === 'منشور'),
  );
  const announcements = filterParentAnnouncements(announcementsRaw, children);

  const { data: proofs } = useLiveOrDemo(
    'paymentProofs',
    [where('guardianUid', '==', profile?.id || '__none__')],
    demoPaymentProofs,
    profile?.id || '__none__',
  );

  const { data: excuses } = useLiveOrDemo(
    'absenceExcuses',
    [where('guardianUid', '==', profile?.id || '__none__')],
    [],
    profile?.id || '__none__',
  );

  // Notes for first two children (hooks limit)
  const id0 = children[0]?.id;
  const id1 = children[1]?.id;
  const { data: notes0 } = useLiveOrDemo(
    id0 ? `students/${id0}/notes` : 'students/__none__/notes',
    [where('visibleToParent', '==', true), orderBy('createdAt', 'desc')],
    ((demoStudentDetail[id0] || demoStudentDetail.s1)?.notes || []).map((n, i) => ({ id: `n0-${i}`, ...n, visibleToParent: true })),
    id0 || '__none__',
  );
  const { data: notes1 } = useLiveOrDemo(
    id1 ? `students/${id1}/notes` : 'students/__none__/notes',
    [where('visibleToParent', '==', true), orderBy('createdAt', 'desc')],
    ((demoStudentDetail[id1] || {})?.notes || []).map((n, i) => ({ id: `n1-${i}`, ...n, visibleToParent: true })),
    id1 || '__none__',
  );

  const { data: pushNotes } = useLiveOrDemo(
    'notifications',
    [where('userId', '==', profile?.id || '__none__'), orderBy('createdAt', 'desc')],
    [],
    profile?.id || '__none__',
  );

  const items = useMemo(() => {
    const rows = [];
    (pushNotes || []).slice(0, 15).forEach((n) => {
      rows.push({
        id: `n-${n.id}`,
        icon: n.type?.includes('exam') ? 'event' : n.type?.includes('grade') ? 'grade' : n.type?.includes('absence') ? 'event_busy' : 'notifications',
        title: n.title || 'تنبيه',
        meta: n.body || '',
        at: n.createdAt,
        to: n.link || '/parent/inbox',
        sort: n.createdAt?.toMillis?.() || 0,
      });
    });
    (announcements || []).slice(0, 8).forEach((a) => {
      rows.push({
        id: `a-${a.id}`,
        icon: 'campaign',
        title: a.title,
        meta: a.audience || 'إعلان',
        at: a.createdAt,
        to: '/parent/announcements',
        sort: a.createdAt?.toMillis?.() || 0,
      });
    });
    (proofs || []).forEach((p) => {
      rows.push({
        id: `p-${p.id}`,
        icon: 'receipt_long',
        title: `وصل دفع — ${p.studentName || ''} · ${p.status}`,
        meta: 'الرسوم',
        at: p.createdAt,
        to: '/parent/fees',
        sort: p.createdAt?.toMillis?.() || 0,
      });
    });
    (excuses || []).forEach((ex) => {
      rows.push({
        id: `e-${ex.id}`,
        icon: 'event_busy',
        title: `تبرير غياب — ${ex.studentName || ''} · ${ex.date}`,
        meta: ex.status || 'قيد المراجعة',
        at: ex.createdAt,
        to: '/parent/absence',
        sort: ex.createdAt?.toMillis?.() || 0,
      });
    });
    const noteChild = (list, childName) => {
      (list || []).filter((n) => n.visibleToParent === true).slice(0, 5).forEach((n) => {
        rows.push({
          id: `note-${n.id}`,
          icon: 'chat',
          title: n.note || n.text || 'ملاحظة من المعلّم',
          meta: [childName, n.by || n.authorName].filter(Boolean).join(' · '),
          at: n.createdAt,
          to: '/parent/notes',
          sort: n.createdAt?.toMillis?.() || (n.daysAgo != null ? Date.now() - n.daysAgo * 86400000 : 0),
        });
      });
    };
    noteChild(notes0, children[0]?.name);
    noteChild(notes1, children[1]?.name);
    rows.sort((a, b) => b.sort - a.sort);
    return rows.slice(0, 40);
  }, [announcements, proofs, excuses, notes0, notes1, children, pushNotes]);

  return (
    <div className="stu-page">
      <ErrorBanner>{error && 'تعذّر تحميل التنبيهات.'}</ErrorBanner>
      <header className="stu-page-head">
        <h1 className="stu-page-title">التنبيهات</h1>
        <p className="stu-page-lead">إشعارات النظام، إعلانات، وصول دفع، تبريرات غياب، وملاحظات المعلّمين.</p>
      </header>

      {items.length === 0 && (
        <div className="card stu-empty-card">
          <Icon name="notifications" size={28} color="var(--gold)" />
          <p>لا تنبيهات حالياً.</p>
        </div>
      )}

      {items.map((item) => (
        <Link key={item.id} to={item.to} className="card stu-inbox-item">
          <div className="stu-feed-icon"><Icon name={item.icon} size={18} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="stu-class-name">{item.title}</div>
            <div className="stu-class-meta">{item.meta}</div>
          </div>
          <span className="stu-feed-time">{relativeFromTimestamp(item.at)}</span>
        </Link>
      ))}
      {demo && <p className="stu-class-meta">وضع العرض التوضيحي.</p>}
    </div>
  );
}
