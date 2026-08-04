import { Link } from 'react-router-dom';
import { orderBy, where } from 'firebase/firestore';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { demoPublicClasses, imageForSubject } from '../../data/demo';

function lessonsLabel(c) {
  if (typeof c.lessons === 'string') return c.lessons;
  const n = c.lessonsCount ?? c.lessons ?? 0;
  if (!n) return null;
  return `${n} درساً`;
}

export default function PublicClasses() {
  const { data } = useLiveOrDemo(
    'classes',
    [where('visibility', '==', 'عام'), orderBy('createdAt', 'desc')],
    demoPublicClasses
  );

  return (
    <div className="site-container">
      <header className="site-page-head">
        <div className="site-section-kicker">دليل الصفوف</div>
        <h1>الصفوف</h1>
        <p className="site-section-lead">
          من الروضة حتى السادس — الصفوف المعلنة للعامة. اضغط على أي صف لعرض التفاصيل.
        </p>
      </header>

      {data.length === 0 ? (
        <p className="site-empty">لا توجد صفوف معلنة للعموم حالياً.</p>
      ) : (
        <div className="site-class-grid">
          {data.map((c, i) => {
            const id = c.id || `pub-class-${i}`;
            const grade = c.level || c.grade || null;
            const lessons = lessonsLabel(c);
            const line = [grade, c.teacher].filter(Boolean).join(' · ');
            const detail = [lessons, c.shift].filter(Boolean).join(' · ');
            return (
              <Link key={id} to={`/site/classes/${id}`} className="site-class-card site-class-card--link">
                <div className="site-class-media">
                  <div className="site-media-img" style={{ backgroundImage: `url('${c.img || imageForSubject(c.subject)}')` }} />
                  {c.subject && <span className="site-class-badge">{c.subject}</span>}
                </div>
                <div className="site-class-body">
                  <h2 className="site-class-title">{c.title}</h2>
                  {line && <p className="site-class-sub">{line}</p>}
                  {detail && <p className="site-class-detail">{detail}</p>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
