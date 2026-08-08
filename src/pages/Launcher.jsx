import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import Logo from '../components/Logo';
import { useAuth } from '../context/AuthContext';
import {
  SCHOOL_LOCATION_AR,
  SCHOOL_NAME_AR,
  SCHOOL_TAGLINE_AR,
  SHOW_FAMILY_PORTALS,
} from '../lib/constants';
import { homePathForRole } from '../lib/loginMemory';
import { ROLE_LABELS } from '../lib/permissions';
import AcademicYearText from '../components/AcademicYearText';

const STAFF_PORTALS = [
  {
    id: 'admin',
    title: 'الإدارة',
    desc: 'القبول · الطلاب · الرسوم · الرواتب · الإعدادات',
    to: '/login/admin',
    icon: 'admin_panel_settings',
  },
  {
    id: 'director',
    title: 'المديرة',
    desc: 'لوحة الإدارة بصلاحيات مخصّصة للشاشات',
    to: '/login/director',
    icon: 'manage_accounts',
  },
  {
    id: 'teacher',
    title: 'المعلّم',
    desc: 'الدروس · الاختبارات · الحضور · الملاحظات',
    to: '/login/teacher',
    icon: 'school',
  },
  {
    id: 'accountant',
    title: 'المحاسب',
    desc: 'الفواتير · الدفعات · الرواتب · السلف',
    to: '/login/accountant',
    icon: 'calculate',
  },
  {
    id: 'reception',
    title: 'الاستقبال',
    desc: 'القبول · التسجيل · ملفات الطلاب',
    to: '/login/reception',
    icon: 'desk',
  },
];

const FAMILY_PORTALS = [
  {
    id: 'parent',
    title: 'ولي الأمر',
    desc: 'متابعة الابن · الرسوم · التقارير',
    to: '/login/parent',
    icon: 'family_restroom',
  },
  {
    id: 'student',
    title: 'الطالب',
    desc: 'الجدول · العلامات · الملاحظات',
    to: '/login/student',
    icon: 'person',
  },
];

export default function Launcher() {
  const navigate = useNavigate();
  const { firebaseUser, profile, role, loading, isFirebaseConfigured, signOut } = useAuth();
  const family = SHOW_FAMILY_PORTALS ? FAMILY_PORTALS : [];
  const sessionReady = isFirebaseConfigured && !loading && firebaseUser && role;
  const continueTo = sessionReady ? homePathForRole(role) : null;

  return (
    <div className="launch-shell" dir="rtl">
      <div className="launch-bg" aria-hidden="true" />
      <div className="launch-inner">
        <header className="launch-top">
          <Logo size={46} />
          <div className="launch-top-meta">
            <span className="launch-year"><AcademicYearText /></span>
            <span className="launch-place">{SCHOOL_TAGLINE_AR}</span>
          </div>
        </header>

        <section className="launch-hero" aria-labelledby="launch-brand">
          <h1 id="launch-brand" className="launch-brand">{SCHOOL_NAME_AR}</h1>
          <p className="launch-lead">
            {SHOW_FAMILY_PORTALS
              ? 'دخول الموظفين وأولياء الأمور والطلاب إلى نظام المدرسة'
              : 'دخول الموظفين إلى نظام إدارة المدرسة'}
          </p>
          {continueTo && (
            <div style={{ marginTop: 18, display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ fontSize: 14 }}
                onClick={() => navigate(continueTo)}
              >
                متابعة كـ{ROLE_LABELS[role] || profile?.name || 'مستخدم'} ←
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ fontSize: 13 }}
                onClick={() => signOut()}
              >
                تسجيل الخروج
              </button>
            </div>
          )}
        </section>

        <section className="launch-section" aria-labelledby="launch-staff">
          <div className="launch-section-head">
            <h2 id="launch-staff" className="launch-section-label">الموظفون</h2>
            <span className="launch-section-hint">اختر القسم لتسجيل الدخول</span>
          </div>
          <div className="launch-grid launch-grid--staff">
            {STAFF_PORTALS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="launch-card"
                onClick={() => navigate(p.to)}
              >
                <span className="launch-card-icon" aria-hidden="true">
                  <Icon name={p.icon} size={20} />
                </span>
                <span className="launch-card-body">
                  <span className="launch-card-title">{p.title}</span>
                  <span className="launch-card-desc">{p.desc}</span>
                </span>
                <span className="launch-card-go" aria-hidden="true">
                  <Icon name="arrow_back" size={16} />
                </span>
              </button>
            ))}
          </div>
        </section>

        {family.length > 0 && (
          <section className="launch-section" aria-labelledby="launch-family">
            <div className="launch-section-head">
              <h2 id="launch-family" className="launch-section-label">أولياء الأمور والطلاب</h2>
            </div>
            <div className="launch-grid launch-grid--family">
              {family.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="launch-card"
                  onClick={() => navigate(p.to)}
                >
                  <span className="launch-card-icon" aria-hidden="true">
                    <Icon name={p.icon} size={20} />
                  </span>
                  <span className="launch-card-body">
                    <span className="launch-card-title">{p.title}</span>
                    <span className="launch-card-desc">{p.desc}</span>
                  </span>
                  <span className="launch-card-go" aria-hidden="true">
                    <Icon name="arrow_back" size={16} />
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="launch-visit" aria-label="الموقع العام">
          <button type="button" className="launch-visit-link" onClick={() => navigate('/site')}>
            <Icon name="public" size={16} />
            الموقع العام
          </button>
          <span className="launch-visit-sep" aria-hidden="true" />
          <button type="button" className="launch-visit-link" onClick={() => navigate('/site/register')}>
            <Icon name="person_add" size={16} />
            طلب تسجيل طالب
          </button>
        </section>

        <footer className="launch-foot">
          <span>{SCHOOL_NAME_AR}</span>
          <span className="launch-foot-dot">·</span>
          <span>{SCHOOL_LOCATION_AR}</span>
        </footer>
      </div>
    </div>
  );
}
