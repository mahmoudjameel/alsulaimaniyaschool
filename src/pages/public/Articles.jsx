import { Link } from 'react-router-dom';
import { orderBy, where } from 'firebase/firestore';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { demoPublicArticles, imageForSubject } from '../../data/demo';

export default function PublicArticles() {
  const { data } = useLiveOrDemo(
    'articles',
    [where('status', '==', 'منشور'), orderBy('createdAt', 'desc')],
    demoPublicArticles
  );

  return (
    <div className="site-container">
      <header className="site-page-head">
        <div className="site-section-kicker">أخبار</div>
        <h1>الأخبار والإعلانات</h1>
        <p className="site-section-lead">
          منشورات المدرسة لأولياء الأمور والزوار. اضغط على أي منشور لقراءة التفاصيل.
        </p>
      </header>

      {data.length === 0 ? (
        <p className="site-empty">لا توجد مقالات منشورة حالياً.</p>
      ) : (
        <div className="site-class-grid site-class-grid--2">
          {data.map((a, i) => {
            const id = a.id || `pub-article-${i}`;
            return (
              <Link key={id} to={`/site/articles/${id}`} className="site-class-card site-class-card--link">
                <div className="site-class-media">
                  <div className="site-media-img" style={{ backgroundImage: `url('${a.img || imageForSubject()}')` }} />
                  {a.category && <span className="site-class-badge">{a.category}</span>}
                </div>
                <div className="site-class-body">
                  <h2 className="site-class-title">{a.title}</h2>
                  <p className="site-class-sub">{a.excerpt}</p>
                  <p className="site-class-detail">
                    {[a.date, a.author].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
