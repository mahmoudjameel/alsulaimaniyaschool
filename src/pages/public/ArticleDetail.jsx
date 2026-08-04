import { Link, useParams } from 'react-router-dom';
import { orderBy, where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { useDocOrDemo, useLiveOrDemo } from '../../hooks/useFirestore';
import { demoPublicArticles, imageForSubject } from '../../data/demo';

function findDemoArticle(id) {
  return demoPublicArticles.find((a) => a.id === id) || null;
}

export default function PublicArticleDetail() {
  const { id } = useParams();
  const demoItem = findDemoArticle(id);
  const { data: liveDoc, loading: docLoading } = useDocOrDemo(id ? `articles/${id}` : null, demoItem);
  const { data: list, loading: listLoading } = useLiveOrDemo(
    'articles',
    [where('status', '==', 'منشور'), orderBy('createdAt', 'desc')],
    demoPublicArticles
  );

  const item = liveDoc || list.find((a) => a.id === id) || demoItem;
  const loading = docLoading || listLoading;
  const others = list.filter((a) => a.id && a.id !== id).slice(0, 3);

  if (loading && !item) {
    return (
      <div className="site-container site-detail">
        <p className="site-empty">جاري التحميل…</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="site-container site-detail">
        <Link to="/site/articles" className="site-back">
          <Icon name="arrow_forward" size={16} /> العودة للأخبار
        </Link>
        <p className="site-empty">المنشور غير موجود أو غير متاح.</p>
      </div>
    );
  }

  const paragraphs = String(item.body || item.content || item.excerpt || '')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="site-container site-detail">
      <Link to="/site/articles" className="site-back">
        <Icon name="arrow_forward" size={16} /> العودة للأخبار
      </Link>

      <article className="site-article-detail">
        <header className="site-article-detail-head">
          <div className="site-card-meta-row">
            {item.category && <span className="tag tag-accent">{item.category}</span>}
            <span className="site-card-date">
              {[item.date, item.read ? `قراءة ${item.read}` : null].filter(Boolean).join(' · ')}
            </span>
          </div>
          <h1>{item.title}</h1>
          {item.author && <p className="site-article-by">بقلم {item.author}</p>}
        </header>

        <div className="site-detail-media site-detail-media--article">
          <div className="site-media-img" style={{ backgroundImage: `url('${item.img || imageForSubject()}')` }} />
        </div>

        <div className="site-article-body">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </article>

      {others.length > 0 && (
        <section className="site-detail-block">
          <h2>منشورات أخرى</h2>
          <div className="site-class-grid site-class-grid--2">
            {others.map((a) => (
              <Link key={a.id} to={`/site/articles/${a.id}`} className="site-class-card site-class-card--link">
                <div className="site-class-media">
                  <div className="site-media-img" style={{ backgroundImage: `url('${a.img || imageForSubject()}')` }} />
                  {a.category && <span className="site-class-badge">{a.category}</span>}
                </div>
                <div className="site-class-body">
                  <h3 className="site-class-title">{a.title}</h3>
                  <p className="site-class-sub">{a.date}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
