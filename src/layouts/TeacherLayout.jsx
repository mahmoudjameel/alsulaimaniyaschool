import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';

const NAV_PRIMARY = [
  { to: '/teacher', end: true, label: 'لوحتي', icon: 'dashboard' },
  { to: '/teacher/punch', label: 'تسجيل الحضور', icon: 'fingerprint' },
  { to: '/teacher/inbox', label: 'إشعاراتي', icon: 'notifications' },
  { to: '/teacher/schedule', label: 'جدول الحصص', icon: 'calendar_month' },
  { to: '/teacher/classes', label: 'صفوفي', icon: 'school' },
  { to: '/teacher/students', label: 'كل طلابي', icon: 'group' },
  { to: '/teacher/attendance', label: 'حضور الطلاب', icon: 'fact_check' },
  { to: '/teacher/attendance-report', label: 'تقرير الحضور', icon: 'analytics' },
  { to: '/teacher/grades', label: 'الدرجات', icon: 'grade' },
  { to: '/teacher/continuous-grades', label: 'دفتر·حضور·نشاط', icon: 'draw' },
  { to: '/teacher/bulk-grades', label: 'رصد جماعي', icon: 'grid_view' },
  { to: '/teacher/grade-sheet', label: 'كشف درجات', icon: 'print' },
  { to: '/teacher/exams', label: 'تقويم اختبارات', icon: 'event' },
  { to: '/teacher/follow-up', label: 'متابعة الطلاب', icon: 'warning' },
  { to: '/teacher/diary', label: 'دفتر اليوم', icon: 'edit_note' },
  { to: '/teacher/observations', label: 'الملاحظات', icon: 'chat' },
  { to: '/teacher/requests', label: 'طلبات واجتماعات', icon: 'handshake' },
];

const NAV_EXTRA = [
  { to: '/teacher/builder', label: 'دروس الصف', icon: 'menu_book' },
  { to: '/teacher/quiz', label: 'اختبارات', icon: 'checklist' },
  { to: '/teacher/profile', label: 'ملفي', icon: 'person' },
];

const TITLES = {
  '/teacher': 'لوحة المعلّم',
  '/teacher/punch': 'تسجيل الحضور والانصراف',
  '/teacher/inbox': 'إشعاراتي',
  '/teacher/schedule': 'جدول الحصص',
  '/teacher/classes': 'صفوفي',
  '/teacher/students': 'كل طلابي',
  '/teacher/attendance': 'حضور الطلاب',
  '/teacher/attendance-report': 'تقرير الحضور',
  '/teacher/grades': 'الدرجات',
  '/teacher/continuous-grades': 'درجات دفتر وحضور ونشاط',
  '/teacher/bulk-grades': 'رصد درجات جماعي',
  '/teacher/grade-sheet': 'كشف درجات للطباعة',
  '/teacher/exams': 'تقويم اختبارات الصف',
  '/teacher/follow-up': 'متابعة الطلاب',
  '/teacher/diary': 'دفتر اليوم',
  '/teacher/observations': 'الملاحظات',
  '/teacher/requests': 'طلبات واجتماعات',
  '/teacher/builder': 'دروس الصف',
  '/teacher/quiz': 'الاختبارات',
  '/teacher/profile': 'ملفي',
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
    if (pathname.includes('/report')) return 'تقرير طالب للطباعة';
    if (pathname.startsWith('/teacher/students/') && pathname !== '/teacher/students') return 'ملف الطالب';
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
          <div>
            <div className="panel-topbar-title">{title}</div>
            <div className="panel-topbar-sub">{greetingForNow()} {firstName}</div>
          </div>
        </header>
        <div className="panel-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
