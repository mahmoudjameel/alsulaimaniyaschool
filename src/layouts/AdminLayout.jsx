import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { useAcademicCalendar } from '../hooks/useAcademicCalendar';
import { CURRENT_ACADEMIC_YEAR } from '../lib/constants';

const NAV_GROUPS = [
  {
    label: 'عام',
    items: [
      { to: '/admin', end: true, label: 'لوحة القيادة', icon: 'dashboard', permission: null },
    ],
  },
  {
    label: 'الطلاب',
    items: [
      { to: '/admin/admissions', label: 'القبول والتسجيل', icon: 'assignment', permission: 'admissions.manage' },
      { to: '/admin/students', label: 'الطلاب', icon: 'group', permission: 'students.manage' },
      { to: '/admin/absence-excuses', label: 'تبريرات الغياب', icon: 'event_available', permission: 'students.manage' },
      { to: '/admin/stages', label: 'المراحل الدراسية', icon: 'school', permission: 'stages.manage' },
    ],
  },
  {
    label: 'المالية',
    items: [
      { to: '/admin/billing', label: 'الفواتير والدفعات', icon: 'receipt_long', permission: 'billing.manage' },
      { to: '/admin/payments', label: 'وصول الدفع', icon: 'fact_check', permission: 'payments.manage' },
      { to: '/admin/fee-aid', label: 'خصم وإعفاء وتقسيط', icon: 'sell', permission: 'billing.manage' },
      { to: '/admin/finance-report', label: 'التقرير المالي', icon: 'analytics', permission: 'billing.manage' },
      { to: '/admin/whatsapp', label: 'تذكير واتساب', icon: 'chat', permission: 'billing.manage' },
      { to: '/admin/payroll', label: 'الرواتب', icon: 'account_balance_wallet', permission: 'payroll.manage' },
      { to: '/admin/staff', label: 'الموظفون والأجور', icon: 'badge', permission: 'staff.manage' },
      { to: '/admin/staff-attendance', label: 'سجلّ الحضور', icon: 'fingerprint', permission: 'staff.manage' },
      { to: '/admin/school-site', label: 'موقع التسجيل المعتمد', icon: 'my_location', permission: 'staff.manage' },
      { to: '/admin/disbursements', label: 'سلف وورديات ومستهلكات', icon: 'payments', permission: 'disbursements.manage' },
      { to: '/admin/expenses', label: 'المصاريف', icon: 'trending_down', permission: 'expenses.manage' },
    ],
  },
  {
    label: 'الأكاديمي',
    items: [
      { to: '/admin/classes', label: 'الصفوف والدروس', icon: 'menu_book', permission: 'classes.manage' },
      { to: '/admin/enrollment', label: 'تسجيل الطلاب في الصفوف', icon: 'person_add', permission: 'enrollment.manage' },
      { to: '/admin/teachers', label: 'دليل المعلّمين', icon: 'co_present', permission: 'teachers.manage' },
      { to: '/admin/grades', label: 'الدرجات', icon: 'grade', permission: 'grades.approve' },
      { to: '/admin/academic-year', label: 'العام الدراسي والترحيل', icon: 'event', permission: 'students.manage' },
      { to: '/admin/staff-hub', label: 'طلبات المعلّمين والاختبارات', icon: 'handshake', permission: 'classes.manage' },
      { to: '/admin/cms', label: 'الموقع والمحتوى', icon: 'newspaper', permission: 'cms.manage' },
    ],
  },
  {
    label: 'النظام',
    items: [
      { to: '/admin/users', label: 'المستخدمون والصلاحيات', icon: 'admin_panel_settings', permission: 'users.manage' },
      { to: '/admin/backup', label: 'نسخ احتياطي ومسح', icon: 'settings_backup_restore', permission: null },
      { to: '/admin/activity', label: 'سجلّ الحركات', icon: 'history', permission: 'activity.view' },
    ],
  },
];

const TITLES = {
  '/admin': 'لوحة القيادة',
  '/admin/admissions': 'القبول والتسجيل',
  '/admin/students': 'الطلاب',
  '/admin/stages': 'المراحل الدراسية',
  '/admin/billing': 'الفواتير والدفعات',
  '/admin/payments': 'وصول الدفع',
  '/admin/fee-aid': 'خصم وإعفاء وتقسيط',
  '/admin/finance-report': 'التقرير المالي',
  '/admin/whatsapp': 'تذكير واتساب',
  '/admin/absence-excuses': 'تبريرات الغياب',
  '/admin/payroll': 'الرواتب',
  '/admin/staff': 'الموظفون والأجور',
  '/admin/staff-attendance': 'سجلّ حضور الموظفين',
  '/admin/school-site': 'موقع التسجيل المعتمد',
  '/admin/disbursements': 'سلف وورديات ومستهلكات',
  '/admin/expenses': 'المصاريف',
  '/admin/classes': 'الصفوف والدروس',
  '/admin/enrollment': 'تسجيل الطلاب في الصفوف',
  '/admin/teachers': 'دليل المعلّمين',
  '/admin/grades': 'الدرجات',
  '/admin/academic-year': 'العام الدراسي والترحيل',
  '/admin/cms': 'الموقع والمحتوى',
  '/admin/users': 'المستخدمون والصلاحيات',
  '/admin/backup': 'نسخ احتياطي ومسح',
  '/admin/activity': 'سجلّ الحركات',
};

export default function AdminLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { profile, signOut, can, isFirebaseConfigured } = useAuth();
  const { calendar } = useAcademicCalendar();
  const [menuOpen, setMenuOpen] = useState(false);
  const yearLabel = calendar?.academicYear || CURRENT_ACADEMIC_YEAR;

  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const title = pathname.startsWith('/admin/students/') ? 'ملف الطالب'
    : pathname.startsWith('/admin/classes/') ? 'تفاصيل الصف'
    : pathname.startsWith('/admin/teachers/') ? 'ملف المعلّم'
    : (TITLES[pathname] || 'لوحة القيادة');

  const groups = useMemo(() => NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => {
      if (!item.permission) return true;
      if (!isFirebaseConfigured) return true;
      return can(item.permission);
    }),
  })).filter((g) => g.items.length > 0), [can, isFirebaseConfigured]);

  const nav = (
    <>
      <div className="panel-brand">
        <Logo size={40} subtitle="لوحة الإدارة" onClick={() => navigate('/')} />
      </div>
      <nav className="panel-nav ah-scroll" aria-label="قائمة الإدارة">
        {groups.map((g) => (
          <div key={g.label} className="panel-nav-group">
            <div className="panel-nav-group-label">{g.label}</div>
            {g.items.map((n) => (
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
        ))}
      </nav>
      <div className="panel-user">
        <div className="panel-user-avatar">{(profile?.name || 'مدير').charAt(0)}</div>
        <div className="panel-user-meta">
          <div className="panel-user-name">{profile?.name || 'مدير عام'}</div>
          <div className="panel-user-title">{profile?.title || 'مدير عام'}</div>
        </div>
        <button type="button" className="btn btn-icon btn-ghost" title="تسجيل الخروج" onClick={() => signOut()}>
          <Icon name="logout" size={16} />
        </button>
      </div>
    </>
  );

  return (
    <div className="panel-shell ah-admin-shell">
      <aside className="panel-aside ah-admin-aside ah-scroll panel-aside--desktop">
        {nav}
      </aside>

      {menuOpen && (
        <div className="panel-drawer" role="dialog" aria-modal="true" aria-label="قائمة التنقّل">
          <button type="button" className="panel-drawer-backdrop" aria-label="إغلاق" onClick={() => setMenuOpen(false)} />
          <aside className="panel-aside panel-aside--drawer ah-scroll">
            {nav}
          </aside>
        </div>
      )}

      <main className="panel-main ah-admin-main ah-scroll">
        <header className="panel-topbar">
          <button
            type="button"
            className="panel-menu-btn"
            aria-label="فتح القائمة"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <Icon name="menu" size={22} />
          </button>
          <h3 className="panel-page-title">{title}</h3>
          <div className="panel-topbar-actions">
            <span className="tag tag-neutral ah-hide-sm">العام الدراسي {yearLabel}</span>
          </div>
        </header>
        <div className="panel-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
