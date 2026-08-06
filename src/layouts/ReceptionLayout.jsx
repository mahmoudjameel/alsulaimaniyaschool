import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { useAcademicYearLabel } from '../components/AcademicYearText';

const NAV = [
  { to: '/reception', end: true, label: 'لوحتي', icon: 'dashboard', permission: null },
  { to: '/reception/punch', label: 'تسجيل الحضور', icon: 'fingerprint', permission: null },
  { to: '/reception/admissions', label: 'القبول والتسجيل', icon: 'assignment', permission: 'admissions.manage' },
  { to: '/reception/students', label: 'ملفات الطلاب', icon: 'group', permission: 'students.manage' },
  { to: '/reception/enrollment', label: 'تسجيل في الصفوف', icon: 'person_add', permission: 'enrollment.manage' },
  { to: '/reception/absence-excuses', label: 'تبريرات الغياب', icon: 'event_available', permission: 'students.manage' },
];

const TITLES = {
  '/reception': 'لوحة الاستقبال',
  '/reception/punch': 'تسجيل الحضور والانصراف',
  '/reception/admissions': 'القبول والتسجيل',
  '/reception/students': 'ملفات الطلاب',
  '/reception/enrollment': 'تسجيل في الصفوف',
  '/reception/absence-excuses': 'تبريرات الغياب',
};

export default function ReceptionLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { profile, signOut, can, isFirebaseConfigured } = useAuth();
  const { academicYear } = useAcademicYearLabel();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const items = useMemo(() => NAV.filter((n) => {
    if (!n.permission) return true;
    if (!isFirebaseConfigured) return true;
    return can(n.permission);
  }), [can, isFirebaseConfigured]);

  const pageTitle = useMemo(() => {
    if (pathname.startsWith('/reception/students/')) return 'ملف الطالب';
    return TITLES[pathname] || 'بوابة الاستقبال';
  }, [pathname]);

  const nav = (
    <>
      <div className="panel-brand">
        <Logo size={40} subtitle="بوابة الاستقبال" onClick={() => navigate('/')} />
      </div>
      <nav className="panel-nav ah-scroll" aria-label="قائمة الاستقبال">
        <div className="panel-nav-group">
          {items.map((n) => (
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
        <div className="panel-user-avatar">{(profile?.name || 'ا').charAt(0)}</div>
        <div className="panel-user-meta">
          <div className="panel-user-name">{profile?.name || 'موظف الاستقبال'}</div>
          <div className="panel-user-title">{profile?.title || 'استقبال وتسجيل'}</div>
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
          <h3 className="panel-page-title">{pageTitle}</h3>
          <span className="tag tag-neutral ah-hide-sm">العام {academicYear}</span>
        </header>
        <div className="panel-content"><Outlet /></div>
      </main>
    </div>
  );
}
