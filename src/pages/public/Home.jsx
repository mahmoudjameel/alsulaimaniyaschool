import { useNavigate, Link } from 'react-router-dom';
import { orderBy, where } from 'firebase/firestore';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import {
  SCHOOL_LOCATION_AR, SCHOOL_NAME_AR, SCHOOL_TYPE_AR,
} from '../../lib/constants';
import { demoPublicFeatured, demoPublicArticles, heroImg, schoolStats, imageForSubject } from '../../data/demo';

export default function PublicHome() {
  const navigate = useNavigate();
  const { data: featured } = useLiveOrDemo('classes', [where('visibility', '==', 'عام'), orderBy('createdAt', 'desc')], demoPublicFeatured);
  const { data: articles } = useLiveOrDemo('articles', [where('status', '==', 'منشور'), orderBy('createdAt', 'desc')], demoPublicArticles);

  return (
    <>
      <section className="site-hero" aria-label="مقدمة المدرسة">
        <div className="site-hero-media" style={{ backgroundImage: `url('${heroImg}')` }} />
        <div className="site-hero-shade" />
        <div className="site-hero-inner">
          <p className="site-hero-place">{SCHOOL_TYPE_AR} · {SCHOOL_LOCATION_AR}</p>
          <h1 className="site-hero-brand">{SCHOOL_NAME_AR}</h1>
          <p className="site-hero-title">من الروضة حتى الصف السادس</p>
          <p className="site-hero-lead">تعليم أساسي منتظم في حي الرمال.</p>
          <div className="site-hero-cta">
            <button type="button" onClick={() => navigate('/site/register')} className="btn btn-primary">طلب تسجيل</button>
            <button type="button" onClick={() => navigate('/site/classes')} className="btn btn-secondary">الصفوف</button>
          </div>
        </div>
      </section>

      <div className="site-container">
        <div className="site-stats" aria-label="أرقام المدرسة">
          <div className="site-stat">
            <div className="site-stat-value">{schoolStats.students}</div>
            <div className="site-stat-label">طالب وطالبة</div>
          </div>
          <div className="site-stat">
            <div className="site-stat-value">{schoolStats.teachers}</div>
            <div className="site-stat-label">معلّماً ومعلّمة</div>
          </div>
          <div className="site-stat">
            <div className="site-stat-value">{schoolStats.years}</div>
            <div className="site-stat-label">سنوات عمل</div>
          </div>
        </div>

        <section className="site-section">
          <div className="site-section-head">
            <div>
              <div className="site-section-kicker">الصفوف</div>
              <h2>صفوف معلنة</h2>
            </div>
            <button type="button" className="site-section-link" onClick={() => navigate('/site/classes')}>
              كل الصفوف
            </button>
          </div>
          <div className="site-class-grid">
            {featured.slice(0, 3).map((c, i) => {
              const id = c.id || `pub-class-${i}`;
              return (
                <Link key={id} to={`/site/classes/${id}`} className="site-class-card site-class-card--link">
                  <div className="site-class-media">
                    <div className="site-media-img" style={{ backgroundImage: `url('${c.img || imageForSubject(c.subject)}')` }} />
                    {c.subject && <span className="site-class-badge">{c.subject}</span>}
                  </div>
                  <div className="site-class-body">
                    <h3 className="site-class-title">{c.title}</h3>
                    <p className="site-class-sub">
                      {[c.level || c.grade, c.teacher].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="site-section site-section--tight">
          <div className="site-section-head">
            <div>
              <div className="site-section-kicker">أخبار</div>
              <h2>آخر المنشورات</h2>
            </div>
            <button type="button" className="site-section-link" onClick={() => navigate('/site/articles')}>
              كل المقالات
            </button>
          </div>
          <div className="site-class-grid site-class-grid--2">
            {articles.slice(0, 4).map((a, i) => {
              const id = a.id || `pub-article-${i}`;
              return (
                <Link key={id} to={`/site/articles/${id}`} className="site-class-card site-class-card--link">
                  <div className="site-class-media">
                    <div className="site-media-img" style={{ backgroundImage: `url('${a.img || imageForSubject()}')` }} />
                    {a.category && <span className="site-class-badge">{a.category}</span>}
                  </div>
                  <div className="site-class-body">
                    <h3 className="site-class-title">{a.title}</h3>
                    <p className="site-class-sub">{a.excerpt}</p>
                    <p className="site-class-detail">{a.date}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="site-cta-band">
          <h2>التسجيل لعام 2026 / 2027</h2>
          <p>عبّئ الطلب من الجوال، ومكتب القبول يتواصل معك.</p>
          <button
            type="button"
            onClick={() => navigate('/site/register')}
            className="btn btn-primary site-cta-band-btn"
          >
            طلب تسجيل
          </button>
        </section>
      </div>
    </>
  );
}
