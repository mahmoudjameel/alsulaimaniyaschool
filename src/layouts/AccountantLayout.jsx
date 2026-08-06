import { useEffect, useMemo, useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { useAcademicYearLabel } from '../components/AcademicYearText';

const NAV = [
  { to: '/accountant', end: true, label: 'لوحتي', icon: 'dashboard', permission: null },
  { to: '/accountant/punch', label: 'تسجيل الحضور', icon: 'fingerprint', permission: null },
  { to: '/accountant/invoices', label: 'فواتير الطلاب', icon: 'receipt_long', permission: 'billing.manage' },
  { to: '/accountant/payments', label: 'وصول الدفع', icon: 'fact_check', permission: 'payments.manage' },
  { to: '/accountant/fee-aid', label: 'خصم وإعفاء وتقسيط', icon: 'sell', permission: 'billing.manage' },
  { to: '/accountant/finance-report', label: 'التقرير المالي', icon: 'analytics', permission: 'billing.manage' },
  { to: '/accountant/whatsapp', label: 'تذكير واتساب', icon: 'chat', permission: 'billing.manage' },
  { to: '/accountant/payroll', label: 'رواتب الموظفين', icon: 'account_balance_wallet', permission: 'payroll.manage' },
  { to: '/accountant/staff', label: 'الموظفون والأجور', icon: 'badge', permission: 'staff.manage' },
  { to: '/accountant/disbursements', label: 'سلف · ورديات · مستهلكات', icon: 'payments', permission: 'disbursements.manage' },
  { to: '/accountant/expenses', label: 'المصاريف', icon: 'trending_down', permission: 'expenses.manage' },
  { to: '/accountant/enrollment', label: 'تسجيل الطلاب بالصفوف', icon: 'assignment_ind', permission: 'enrollment.manage' },
];

const TITLES = {
  '/accountant': 'لوحة المحاسب',
  '/accountant/punch': 'تسجيل الحضور والانصراف',
  '/accountant/invoices': 'فواتير الطلاب',
  '/accountant/payments': 'وصول الدفع',
  '/accountant/fee-aid': 'خصم وإعفاء وتقسيط',
  '/accountant/finance-report': 'التقرير المالي',
  '/accountant/whatsapp': 'تذكير واتساب',
  '/accountant/payroll': 'رواتب الموظفين',
  '/accountant/staff': 'الموظفون والأجور',
  '/accountant/disbursements': 'سلف وورديات',
  '/accountant/expenses': 'المصاريف',
  '/accountant/enrollment': 'تسجيل بالصفوف',
};

function accountantPermissionForPath(pathname) {
  let best = null;
  for (const item of NAV) {
    if (item.to === '/accountant') {
      if (pathname === '/accountant' || pathname === '/accountant/') best = item;
      continue;
    }
    if (pathname === item.to || pathname.startsWith(`${item.to}/`)) {
      if (!best || item.to.length > best.to.length) best = item;
    }
  }
  return best?.permission || null;
}

function AccountantOutletGuard() {
  const { pathname } = useLocation();
  const { can, isFirebaseConfigured } = useAuth();
  if (!isFirebaseConfigured) return <Outlet />;
  const perm = accountantPermissionForPath(pathname);
  if (perm && !can(perm)) return <Navigate to="/accountant" replace />;
  return <Outlet />;
}

export default function AccountantLayout() {
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

  const pageTitle = TITLES[pathname] || 'بوابة المحاسب';

  const nav = (
    <>
      <div className="panel-brand">
        <Logo size={40} subtitle="بوابة المحاسب" onClick={() => navigate('/')} />
      </div>
      <nav className="panel-nav ah-scroll" aria-label="قائمة المحاسب">
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
        <div className="panel-user-avatar">{(profile?.name || 'م').charAt(0)}</div>
        <div className="panel-user-meta">
          <div className="panel-user-name">{profile?.name || 'ليلى حسن'}</div>
          <div className="panel-user-title">{profile?.title || 'مسؤولة مالية'}</div>
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
        <div className="panel-content"><AccountantOutletGuard /></div>
      </main>
    </div>
  );
}
