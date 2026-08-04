import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';

const NAV_PRIMARY = [
  { to: '/teacher', end: true, label: 'لوحتي', icon: 'dashboard' },
  { to: '/teacher/schedule', label: 'جدول الحصص', icon: 'calendar_month' },
  { to: '/teacher/classes', label: 'صفوفي وطلابي', icon: 'school' },
  { to: '/teacher/attendance', label: 'الحضور والغياب', icon: 'fact_check' },
  { to: '/teacher/attendance-report', label: 'تقرير الحضور', icon: 'analytics' },
  { to: '/teacher/grades', label: 'الدرجات', icon: 'grade' },
  { to: '/teacher/diary', label: 'دفتر اليوم', icon: 'edit_note' },
  { to: '/teacher/observations', label: 'الملاحظات', icon: 'chat' },
];

const NAV_EXTRA = [
  { to: '/teacher/builder', label: 'محتوى الدروس', icon: 'menu_book' },
  { to: '/teacher/quiz', label: 'اختبارات', icon: 'checklist' },
];

const TITLES = {
  '/teacher': 'لوحة المعلّم',
  '/teacher/schedule': 'جدول الحصص',
  '/teacher/classes': 'صفوفي وطلابي',
  '/teacher/attendance': 'الحضور والغياب',
  '/teacher/attendance-report': 'تقرير الحضور',
  '/teacher/grades': 'الدرجات',
  '/teacher/diary': 'دفتر اليوم',
  '/teacher/observations': 'الملاحظات',
  '/teacher/builder': 'محتوى الدروس',
  '/teacher/quiz': 'الاختبارات',
};

function greetingForNow() {
  const h = new Date().getHours();
  if (h < 12) return 'صباح الخير';
  if (h < 17) return 'مساء الخير';
  return 'مساء الخير';
}

export default function TeacherLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { profile, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const firstName = (profile?.name || 'المعلّم').split(' ')[0];

  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const title = useMemo(() => {
    if (pathname.startsWith('/teacher/classes/') && pathname !== '/teacher/classes') return 'تفاصيل الصف';
    return TITLES[pathname] || 'لوحة المعلّم';
  }, [pathname]);

  const nav = (
    <>
      <div className="panel-brand">
        <Logo size={40} subtitle="بوابة المعلّم" onClick={() => navigate('/')} />
      </div>
      <nav className="panel-nav ah-scroll" aria-label="قائمة المعلّم">
        <div className="panel-nav-group">
          <div className="panel-nav-group-label">اليوم الدراسي</div>
          {NAV_PRIMARY.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="panel-nav-link" onClick={() => setMenuOpen(false)}>
              {({ isActive }) => (
                <span className="ah-nav-item" data-active={isActive}>
                  <Icon name={n.icon} size={17} />
                  <span className="ah-nav-label">{n.label}</span>
                </span>
              )}
            </NavLink>
          ))}
        </div>
        <div className="panel-nav-group">
          <div className="panel-nav-group-label">أدوات إضافية</div>
          {NAV_EXTRA.map((n) => (
            <NavLink key={n.to} to={n.to} className="panel-nav-link" onClick={() => setMenuOpen(false)}>
              {({ isActive }) => (
                <span className="ah-nav-item" data-active={isActive}>
                  <Icon name={n.icon} size={17} />
                  <span className="ah-nav-label">{n.label}</span>
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
      <div className="panel-user">
        <div className="panel-user-avatar">{(profile?.name || 'م').charAt(0)}</div>
        <div className="panel-user-meta">
          <div className="panel-user-name">{profile?.name || 'معلّم'}</div>
          <div className="panel-user-title">{profile?.title || 'معلّم'}</div>
        </div>
        <button type="button" className="btn btn-icon btn-ghost" title="تسجيل الخروج" onClick={() => signOut()}>
          <Icon name="logout" size={16} />
        </button>
      </div>
    </>
  );

  return (
    <div className="panel-shell ah-admin-shell">
      <aside className="panel-aside ah-admin-aside ah-scroll panel-aside--desktop no-print">{nav}</aside>
      {menuOpen && (
        <div className="panel-drawer no-print" role="dialog" aria-modal="true">
          <button type="button" className="panel-drawer-backdrop" aria-label="إغلاق" onClick={() => setMenuOpen(false)} />
          <aside className="panel-aside panel-aside--drawer ah-scroll">{nav}</aside>
        </div>
      )}
      <main className="panel-main ah-admin-main ah-scroll">
        <header className="panel-topbar no-print">
          <button type="button" className="panel-menu-btn" aria-label="فتح القائمة" onClick={() => setMenuOpen(true)}>
            <Icon name="menu" size={22} />
          </button>
          <div style={{ minWidth: 0 }}>
            <h3 className="panel-page-title" style={{ margin: 0 }}>{title}</h3>
            {pathname === '/teacher' && (
              <div style={{ fontSize: 12, color: 'var(--color-neutral-500)', marginTop: 2 }}>
                {greetingForNow()}، أ. {firstName}
              </div>
            )}
          </div>
          <div className="panel-topbar-actions ah-hide-sm">
            <button type="button" className="btn btn-secondary" style={{ fontSize: 13 }} onClick={() => navigate('/teacher/attendance')}>
              حضور اليوم
            </button>
          </div>
        </header>
        <div className="panel-content"><Outlet /></div>
      </main>
    </div>
  );
}
