import { useMemo, useState } from 'react';
import { orderBy } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import { ErrorBanner } from '../../components/ui';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { demoClasses } from '../../data/demo';
import NewClassModal from '../../modals/NewClassModal';

export default function Classes() {
  const navigate = useNavigate();
  const { data, error, demo } = useLiveOrDemo('classes', [orderBy('createdAt', 'desc')], demoClasses);
  const [showModal, setShowModal] = useState(false);
  const [shiftFilter, setShiftFilter] = useState('الكل');

  const filtered = useMemo(
    () => data.filter((c) => shiftFilter === 'الكل' || c.shift === shiftFilter),
    [data, shiftFilter]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ErrorBanner>{error && 'تعذّر تحميل الصفوف.'}</ErrorBanner>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h4 style={{ margin: 0 }}>الصفوف والمناهج</h4>
        <Link to="/admin/teachers" className="ah-tablink" style={{ color: 'var(--gold)', fontSize: 13 }}>دليل المعلّمين ←</Link>
        <select className="input" style={{ width: 'auto', fontSize: 13, marginInlineStart: 'auto' }} value={shiftFilter} onChange={(e) => setShiftFilter(e.target.value)}>
          <option value="الكل">الدوام: الكل</option>
          <option value="صباحي">صباحي</option>
          <option value="مسائي">مسائي</option>
        </select>
        <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => setShowModal(true)}><Icon name="add" size={14} /> صفّ جديد</button>
      </div>
      <div className="ah-3col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        {filtered.map((c, i) => (
          <button
            key={c.id || i}
            className="card"
            onClick={() => c.id && navigate(`/admin/classes/${c.id}`)}
            style={{ textAlign: 'right', cursor: c.id ? 'pointer' : 'default', background: 'transparent', border: '1px solid var(--color-divider)' }}
          >
            <div className="ah-cover">صورة الغلاف</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span className="tag tag-outline">{c.subject}</span>
              <span className={`tag tag-${c.tone || 'neutral'}`}>{c.visibility}</span>
              {c.shift && <span className="tag tag-neutral">{c.shift}</span>}
            </div>
            <div className="card-title" style={{ fontSize: 16 }}>{c.title}</div>
            <div className="card-meta">{c.grade ? `${c.grade} · ` : ''}{c.teacher} · {c.lessons ?? c.lessonsCount ?? 0} درساً · {c.studentsCount ?? c.students ?? 0} طالباً</div>
          </button>
        ))}
      </div>
      {showModal && <NewClassModal demo={demo} onClose={() => setShowModal(false)} />}
    </div>
  );
}
