import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import { contactInfo } from '../data/demo';
import {
  SCHOOL_LOCATION_AR, SCHOOL_NAME_AR, SCHOOL_NEIGHBORHOOD_AR, SCHOOL_TYPE_AR,
} from '../lib/constants';

const NAV = [
  { to: '/site', end: true, label: 'الرئيسية' },
  { to: '/site/classes', label: 'الصفوف' },
  { to: '/site/teachers', label: 'المعلّمون' },
  { to: '/site/articles', label: 'المقالات' },
  { to: '/site/register', label: 'التسجيل' },
];

export default function PublicLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="site-header-inner">
          <NavLink to="/site" end className="site-brand" onClick={() => setMenuOpen(false)}>
            <img src="/assets/logo-mark.png" alt="" />
            <div className="site-brand-text">
              <div className="site-brand-name">{SCHOOL_NAME_AR}</div>
              <div className="site-brand-sub">{SCHOOL_TYPE_AR} · {SCHOOL_NEIGHBORHOOD_AR}، غزّة</div>
            </div>
          </NavLink>

          <nav className="site-nav" aria-label="التنقّل الرئيسي">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}>{n.label}</NavLink>
            ))}
          </nav>

          <div className="site-header-actions">
            <button
              type="button"
              className="btn btn-primary site-desktop-only"
              style={{ fontSize: 13 }}
              onClick={() => navigate('/site/register')}
            >
              سجّل الآن
            </button>
            <button
              type="button"
              className="site-menu-btn"
              aria-expanded={menuOpen}
              aria-controls="site-mobile-nav"
              aria-label={menuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <Icon name={menuOpen ? 'close' : 'menu'} size={22} />
            </button>
          </div>
        </div>

        <div id="site-mobile-nav" className="site-mobile-panel" data-open={menuOpen ? 'true' : 'false'}>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>{n.label}</NavLink>
          ))}
          <button
            type="button"
            className="btn btn-primary btn-block site-mobile-cta"
            onClick={() => navigate('/site/register')}
          >
            سجّل طفلك الآن
          </button>
        </div>
      </header>

      <main className="site-main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <div className="site-footer-brand-block">
            <div className="site-footer-brand">
              <img src="/assets/logo-mark.png" alt="" />
              <div>
                <strong>{SCHOOL_NAME_AR}</strong>
                <span className="site-footer-tag">{SCHOOL_TYPE_AR} · {SCHOOL_LOCATION_AR}</span>
              </div>
            </div>
            <p>من الروضة حتى الصف السادس — حي الرمال، غزّة.</p>
          </div>

          <div className="site-footer-cols">
            <div>
              <h3>تواصل</h3>
              <div className="site-footer-list">
                <div className="site-footer-row">
                  <Icon name="location_on" size={16} />
                  <span>{contactInfo.addr}</span>
                </div>
                <div className="site-footer-row">
                  <Icon name="call" size={16} />
                  <a href={`tel:${contactInfo.phone.replace(/\s/g, '')}`} dir="ltr">{contactInfo.phone}</a>
                </div>
                <div className="site-footer-row">
                  <Icon name="mail" size={16} />
                  <a href={`mailto:${contactInfo.email}`} dir="ltr">{contactInfo.email}</a>
                </div>
              </div>
            </div>
            <div>
              <h3>روابط</h3>
              <nav className="site-footer-links" aria-label="روابط سريعة">
                <NavLink to="/site" end>الرئيسية</NavLink>
                <NavLink to="/site/classes">الصفوف</NavLink>
                <NavLink to="/site/teachers">المعلّمون</NavLink>
                <NavLink to="/site/articles">المقالات</NavLink>
                <NavLink to="/site/register">التسجيل</NavLink>
              </nav>
            </div>
          </div>
        </div>
        <div className="site-footer-bottom">
          © {new Date().getFullYear()} {SCHOOL_NAME_AR}
        </div>
      </footer>
    </div>
  );
}
