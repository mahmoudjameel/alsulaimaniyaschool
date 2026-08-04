import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/teacher', end: true, label: 'لوحتي', icon: 'dashboard' },
  { to: '/teacher/builder', label: 'محرّر الدرس', icon: 'menu_book' },
  { to: '/teacher/quiz', label: 'الاختبارات والأنشطة', icon: 'checklist' },
  { to: '/teacher/grades', label: 'الدرجات', icon: 'grade' },
  { to: '/teacher/attendance', label: 'الحضور والغياب', icon: 'fact_check' },
  { to: '/teacher/observations', label: 'الملاحظات', icon: 'chat' },
];

export default function TeacherLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { profile, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const firstName = (profile?.name || 'خالد').split(' ')[0];

  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const nav = (
    <>
      <div className="panel-brand">
        <Logo size={40} subtitle="بوابة المعلّم" onClick={() => navigate('/')} />
      </div>
      <nav className="panel-nav ah-scroll" aria-label="قائمة المعلّم">
        <div className="panel-nav-group">
          {NAV.map((n) => (
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
      </nav>
      <div className="panel-user">
        <div className="panel-user-avatar">{(profile?.name || 'خ').charAt(0)}</div>
        <div className="panel-user-meta">
          <div className="panel-user-name">{profile?.name || 'أ. خالد الأحمد'}</div>
          <div className="panel-user-title">{profile?.title || 'معلّم لغة عربية'}</div>
        </div>
        <button type="button" className="btn btn-icon btn-ghost" title="تسجيل الخروج" onClick={() => signOut()}>
          <Icon name="logout" size={16} />
        </button>
      </div>
    </>
  );

  return (
    <div className="panel-shell ah-admin-shell">
      <aside className="panel-aside ah-admin-aside ah-scroll panel-aside--desktop">{nav}</aside>
      {menuOpen && (
        <div className="panel-drawer" role="dialog" aria-modal="true">
          <button type="button" className="panel-drawer-backdrop" aria-label="إغلاق" onClick={() => setMenuOpen(false)} />
          <aside className="panel-aside panel-aside--drawer ah-scroll">{nav}</aside>
        </div>
      )}
      <main className="panel-main ah-admin-main ah-scroll">
        <header className="panel-topbar">
          <button type="button" className="panel-menu-btn" aria-label="فتح القائمة" onClick={() => setMenuOpen(true)}>
            <Icon name="menu" size={22} />
          </button>
          <h3 className="panel-page-title">مساء الخير، أ. {firstName}</h3>
          <div className="panel-topbar-actions ah-hide-sm">
            <button type="button" className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => navigate('/teacher/builder')}>
              درس جديد
            </button>
          </div>
        </header>
        <div className="panel-content"><Outlet /></div>
      </main>
    </div>
  );
}
