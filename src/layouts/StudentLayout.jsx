import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { SCHOOL_NAME_AR } from '../lib/constants';

const PRIMARY_NAV = [
  { to: '/student', end: true, label: 'الرئيسية', icon: 'home' },
  { to: '/student/today', label: 'اليوم', icon: 'today' },
  { to: '/student/classes', label: 'صفوفي', icon: 'menu_book' },
  { to: '/student/inbox', label: 'تنبيهات', icon: 'notifications' },
];

const MORE_NAV = [
  { to: '/student/grades', label: 'الدرجات', icon: 'grade' },
  { to: '/student/attendance', label: 'الحضور', icon: 'event_available' },
  { to: '/student/homework', label: 'الواجبات', icon: 'assignment' },
  { to: '/student/achievements', label: 'تقدّمي', icon: 'emoji_events' },
  { to: '/student/fees', label: 'المستحقات', icon: 'payments' },
  { to: '/student/announcements', label: 'الإعلانات', icon: 'campaign' },
  { to: '/student/notes', label: 'ملاحظات', icon: 'chat' },
];

export default function StudentLayout() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);
  const name = profile?.name || 'الطالب';

  const onLogout = () => signOut().then(() => navigate('/'));
  const closeMore = () => setMoreOpen(false);

  useEffect(() => {
    if (!moreOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closeMore(); };
    const onDoc = (e) => {
      if (e.target.closest('.stu-more-sheet') || e.target.closest('.stu-bottomnav')) return;
      if (moreRef.current && !moreRef.current.contains(e.target)) closeMore();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDoc);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDoc);
    };
  }, [moreOpen]);

  return (
    <div className="stu-shell">
      <header className="stu-topbar">
        <div className="stu-topbar-in">
          <div className="stu-brand">
            <img src="/assets/logo-mark.png" alt="" className="stu-logo" />
            <div className="stu-brand-text">
              <div className="stu-brand-name">{SCHOOL_NAME_AR}</div>
              <div className="stu-brand-sub">بوابة الطالب</div>
            </div>
          </div>

          <nav className="stu-nav-desktop" aria-label="تنقّل الطالب">
            {PRIMARY_NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) => `stu-nav-link${isActive ? ' is-active' : ''}`}
              >
                {n.label}
              </NavLink>
            ))}
            <div className="stu-more-desktop" ref={moreRef}>
              <button
                type="button"
                className={`stu-nav-link stu-more-trigger${moreOpen ? ' is-active' : ''}`}
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                onClick={() => setMoreOpen((o) => !o)}
              >
                المزيد
                <Icon name="expand_more" size={16} />
              </button>
              {moreOpen && (
                <div className="stu-more-dropdown" role="menu">
                  {MORE_NAV.map((n) => (
                    <NavLink
                      key={n.to}
                      to={n.to}
                      role="menuitem"
                      className="stu-more-drop-item"
                      onClick={closeMore}
                    >
                      <Icon name={n.icon} size={18} color="var(--gold)" />
                      <span>{n.label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          </nav>

          <div className="stu-top-actions">
            <div className="stu-user" title={name}>
              <div className="stu-avatar">{name.charAt(0)}</div>
              <div className="stu-user-meta">
                <div className="stu-user-name">{name}</div>
                {profile?.displayId && <div className="stu-user-id" dir="ltr">{profile.displayId}</div>}
              </div>
            </div>
            <button type="button" className="btn btn-ghost stu-logout" onClick={onLogout} aria-label="تسجيل الخروج">
              <Icon name="logout" size={16} />
              <span className="stu-logout-label">خروج</span>
            </button>
          </div>
        </div>
      </header>

      <main className="stu-main">
        <Outlet />
      </main>

      <nav className="stu-bottomnav" aria-label="تنقّل سريع">
        {PRIMARY_NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className="stu-bottom-link" onClick={closeMore}>
            {({ isActive }) => (
              <>
                <Icon name={n.icon} size={22} color={isActive ? 'var(--gold)' : 'var(--color-neutral-500)'} />
                <span data-active={isActive || undefined}>{n.label}</span>
              </>
            )}
          </NavLink>
        ))}
        <button type="button" className="stu-bottom-link" onClick={() => setMoreOpen((o) => !o)}>
          <Icon name="apps" size={22} color={moreOpen ? 'var(--gold)' : 'var(--color-neutral-500)'} />
          <span data-active={moreOpen || undefined}>المزيد</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="stu-more-sheet">
          <button type="button" className="stu-more-backdrop" aria-label="إغلاق" onClick={closeMore} />
          <div className="stu-more-panel">
            <div className="stu-more-title">المزيد</div>
            <div className="stu-more-grid">
              {MORE_NAV.map((n) => (
                <NavLink key={n.to} to={n.to} className="stu-more-item" onClick={closeMore}>
                  <Icon name={n.icon} size={20} color="var(--gold)" />
                  <span>{n.label}</span>
                </NavLink>
              ))}
              <button type="button" className="stu-more-item" onClick={onLogout}>
                <Icon name="logout" size={20} color="var(--color-neutral-600)" />
                <span>خروج</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
