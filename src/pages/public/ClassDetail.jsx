import { Link, useParams } from 'react-router-dom';
import { orderBy, where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { useDocOrDemo, useLiveOrDemo } from '../../hooks/useFirestore';
import { demoPublicClasses, imageForSubject } from '../../data/demo';

function findDemoClass(id) {
  return demoPublicClasses.find((c) => c.id === id) || null;
}

function lessonsLabel(c) {
  if (!c) return null;
  if (typeof c.lessons === 'string') return c.lessons;
  const n = c.lessonsCount ?? c.lessons ?? 0;
  if (!n) return null;
  return `${n} درساً`;
}

export default function PublicClassDetail() {
  const { id } = useParams();
  const demoItem = findDemoClass(id);
  const { data: liveDoc, loading: docLoading } = useDocOrDemo(id ? `classes/${id}` : null, demoItem);
  const { data: list, loading: listLoading } = useLiveOrDemo(
    'classes',
    [where('visibility', '==', 'عام'), orderBy('createdAt', 'desc')],
    demoPublicClasses
  );

  const item = liveDoc || list.find((c) => c.id === id) || demoItem;
  const loading = docLoading || listLoading;

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
        <Link to="/site/classes" className="site-back">
          <Icon name="arrow_forward" size={16} /> العودة للصفوف
        </Link>
        <p className="site-empty">الصف غير موجود أو غير معلن للعامة.</p>
      </div>
    );
  }

  const grade = item.level || item.grade || null;
  const lessons = lessonsLabel(item);
  const schedule = Array.isArray(item.schedule) ? item.schedule : [];

  return (
    <div className="site-container site-detail">
      <Link to="/site/classes" className="site-back">
        <Icon name="arrow_forward" size={16} /> العودة للصفوف
      </Link>

      <div className="site-detail-hero">
        <div className="site-detail-media">
          <div className="site-media-img" style={{ backgroundImage: `url('${item.img || imageForSubject(item.subject)}')` }} />
        </div>
        <div className="site-detail-intro">
          {item.subject && <span className="tag tag-outline">{item.subject}</span>}
          <h1>{item.title}</h1>
          <p className="site-detail-lead">
            {[grade, item.teacher].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      <dl className="site-detail-facts">
        {grade && (
          <div>
            <dt>الصف</dt>
            <dd>{grade}</dd>
          </div>
        )}
        {item.teacher && (
          <div>
            <dt>المعلّم</dt>
            <dd>{item.teacher}</dd>
          </div>
        )}
        {lessons && (
          <div>
            <dt>الدروس</dt>
            <dd>{lessons}</dd>
          </div>
        )}
        {item.shift && (
          <div>
            <dt>الفترة</dt>
            <dd>{item.shift}</dd>
          </div>
        )}
        {item.students != null && (
          <div>
            <dt>الطلاب</dt>
            <dd>{item.students}</dd>
          </div>
        )}
      </dl>

      {(item.description || item.desc) && (
        <section className="site-detail-block">
          <h2>عن الصف</h2>
          <p>{item.description || item.desc}</p>
        </section>
      )}

      {schedule.length > 0 && (
        <section className="site-detail-block">
          <h2>الجدول</h2>
          <ul className="site-detail-schedule">
            {schedule.map((s, i) => (
              <li key={i}>
                <strong>{s.day}</strong>
                <span dir="ltr">{s.start} – {s.end}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="site-detail-actions">
        <Link to="/site/register" className="btn btn-primary">طلب تسجيل</Link>
        <Link to="/site/classes" className="btn btn-secondary">كل الصفوف</Link>
      </div>
    </div>
  );
}
