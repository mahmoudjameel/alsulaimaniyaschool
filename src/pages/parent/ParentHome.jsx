import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { orderBy, where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { ErrorBanner } from '../../components/ui';
import { filterParentAnnouncements, useMyChildren } from '../../hooks/useMyChildren';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { formatILS } from '../../lib/constants';
import { relativeFromTimestamp, relativeHoursAr } from '../../lib/relativeTime';
import { demoAnnouncements, demoParentFeed, demoPaymentProofs } from '../../data/demo';

const QUICK = [
  { to: '/parent/fees', icon: 'payments', label: 'الرسوم' },
  { to: '/parent/grades', icon: 'grade', label: 'الدرجات' },
  { to: '/parent/attendance', icon: 'event_available', label: 'الحضور' },
  { to: '/parent/notes', icon: 'chat', label: 'ملاحظات' },
  { to: '/parent/absence', icon: 'event_busy', label: 'تبرير غياب' },
  { to: '/parent/announcements', icon: 'campaign', label: 'إعلانات' },
  { to: '/parent/progress', icon: 'trending_up', label: 'التقدّم' },
  { to: '/parent/inbox', icon: 'notifications', label: 'تنبيهات' },
];

export default function ParentHome() {
  const { profile, children, error, demo, displayName } = useMyChildren();

  const { data: announcementsRaw } = useLiveOrDemo(
    'announcements',
    [where('status', '==', 'منشور'), orderBy('createdAt', 'desc')],
    demoAnnouncements.filter((a) => a.status === 'منشور'),
  );
  const announcements = filterParentAnnouncements(announcementsRaw, children).slice(0, 4);

  const { data: proofs } = useLiveOrDemo(
    'paymentProofs',
    [where('guardianUid', '==', profile?.id || '__none__')],
    demoPaymentProofs,
    profile?.id || '__none__',
  );

  const feed = useMemo(() => {
    if (demo) return demoParentFeed;
    const items = [];
    (announcements || []).forEach((a) => {
      items.push({
        id: `ann-${a.id}`,
        icon: 'campaign',
        text: a.title,
        at: a.createdAt,
        to: '/parent/announcements',
      });
    });
    [...(proofs || [])]
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
      .slice(0, 4)
      .forEach((p) => {
        items.push({
          id: `pp-${p.id}`,
          icon: 'receipt_long',
          text: `وصل دفع ${p.status || ''} — ${p.studentName || ''}`.trim(),
          at: p.createdAt,
          to: '/parent/fees',
        });
      });
    items.sort((a, b) => (b.at?.toMillis?.() || 0) - (a.at?.toMillis?.() || 0));
    return items.slice(0, 8);
  }, [demo, announcements, proofs]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'صباح الخير';
    if (h < 17) return 'مرحباً';
    return 'مساء الخير';
  })();

  return (
    <div className="stu-page">
      <ErrorBanner>{error && 'تعذّر تحميل بيانات أبنائك.'}</ErrorBanner>

      <section className="stu-hero">
        <div className="stu-hero-text">
          <p className="stu-kicker">{greeting}</p>
          <h1 className="stu-hello">{displayName}</h1>
          <p className="stu-hello-sub">
            {children.length ? `${children.length} ${children.length === 1 ? 'ابن/ة مرتبط' : 'أبناء مرتبطون'}` : 'لا أبناء مرتبطون بعد'}
          </p>
        </div>
        <div className="stu-hero-stats">
          <div className="stu-stat">
            <span className="stu-stat-val">{children.length}</span>
            <span className="stu-stat-lbl">أبناء</span>
          </div>
          <div className="stu-stat">
            <span className="stu-stat-val" style={{ fontSize: 15 }}>
              {formatILS(children.reduce((s, c) => s + (c.due || 0), 0))}
            </span>
            <span className="stu-stat-lbl">إجمالي مستحق</span>
          </div>
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

      <section>
        <div className="stu-section-head">
          <h2 className="card-title" style={{ margin: 0 }}>أبنائي</h2>
        </div>
        {children.length === 0 && (
          <div className="card stu-empty-card">
            <Icon name="family_restroom" size={28} color="var(--gold)" />
            <p>لا يوجد أبناء مرتبطون بحسابك بعد. سجّل الدخول برقم الجوال المسجّل لدى المدرسة.</p>
          </div>
        )}
        <div className="stu-class-grid">
          {children.map((c) => (
            <div key={c.id} className="card" style={{ gap: 10 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div className="stu-avatar" style={{ width: 44, height: 44, fontSize: 18 }}>{c.initial}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="stu-class-card-title" style={{ fontSize: 17 }}>{c.name}</div>
                  <div className="stu-class-meta">{c.grade || '—'}</div>
                </div>
              </div>
              <div className="stu-class-meta">
                المستحق: <strong className="ah-tabnum">{c.due > 0 ? formatILS(c.due) : 'لا مستحقات'}</strong>
              </div>
              <div className="stu-actions-row">
                <Link to="/parent/progress" className="btn btn-secondary" style={{ fontSize: 12, textDecoration: 'none' }}>التقدّم</Link>
                <Link to={`/parent/report-card/${c.id}`} className="btn btn-secondary" style={{ fontSize: 12, textDecoration: 'none' }}>كشف العلامات</Link>
                <Link to="/parent/fees" className="btn btn-primary" style={{ fontSize: 12, textDecoration: 'none' }}>الرسوم</Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="stu-grid-2">
        <section className="card">
          <div className="stu-section-head">
            <h2 className="card-title" style={{ margin: 0 }}>آخر التحديثات</h2>
            <Link to="/parent/inbox" style={{ fontSize: 12 }}>الكل</Link>
          </div>
          {feed.length === 0 && <p className="stu-empty">لا تحديثات حالياً.</p>}
          {feed.map((f, i) => (
            <Link
              key={f.id || i}
              to={f.to || '/parent/inbox'}
              className="stu-feed-row"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="stu-feed-icon"><Icon name={f.icon} size={17} /></div>
              <div className="stu-class-body">
                <div className="stu-class-name">{f.text}</div>
              </div>
              <span className="stu-feed-time">
                {f.hoursAgo != null ? relativeHoursAr(f.hoursAgo) : relativeFromTimestamp(f.at)}
              </span>
            </Link>
          ))}
        </section>

        <section className="card">
          <h2 className="card-title" style={{ marginBottom: 10 }}>روابط سريعة</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link to="/parent/fees" className="stu-quick-item" style={{ flexDirection: 'row', justifyContent: 'flex-start', gap: 10, padding: 12 }}>
              <Icon name="upload_file" size={18} color="var(--gold)" /> إرفاق وصل دفع
            </Link>
            <Link to="/parent/absence" className="stu-quick-item" style={{ flexDirection: 'row', justifyContent: 'flex-start', gap: 10, padding: 12 }}>
              <Icon name="event_busy" size={18} color="var(--gold)" /> تبرير غياب
            </Link>
            <Link to="/parent/notes" className="stu-quick-item" style={{ flexDirection: 'row', justifyContent: 'flex-start', gap: 10, padding: 12 }}>
              <Icon name="chat" size={18} color="var(--gold)" /> ملاحظات المعلّمين
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
