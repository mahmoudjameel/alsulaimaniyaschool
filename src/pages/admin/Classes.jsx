import { useMemo, useState } from 'react';
import { orderBy } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import { ErrorBanner } from '../../components/ui';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { useAuth } from '../../context/AuthContext';
import { demoClasses } from '../../data/demo';
import NewClassModal from '../../modals/NewClassModal';
import EditClassModal from '../../modals/EditClassModal';
import { deleteClass } from '../../services/academics';
import { logActivity } from '../../services/activity';

export default function Classes() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data, error, demo } = useLiveOrDemo('classes', [orderBy('createdAt', 'desc')], demoClasses);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [shiftFilter, setShiftFilter] = useState('الكل');

  const filtered = useMemo(
    () => data.filter((c) => shiftFilter === 'الكل' || c.shift === shiftFilter),
    [data, shiftFilter],
  );

  const onDelete = async (c, e) => {
    e.stopPropagation();
    if (demo || !c?.id) return;
    if (!window.confirm(`حذف الصف «${c.title}»؟`)) return;
    setBusyId(c.id);
    try {
      await deleteClass(c.id);
      await logActivity({
        type: 'class_deleted',
        actorUid: profile?.id,
        actorName: profile?.name,
        actorRole: profile?.role,
        summary: `حذف صف: ${c.title}`,
        targetType: 'class',
        targetId: c.id,
      });
    } catch {
      window.alert('تعذّر حذف الصف.');
    } finally {
      setBusyId(null);
    }
  };

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
        <button type="button" className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => setShowModal(true)}><Icon name="add" size={14} /> صفّ جديد</button>
      </div>
      <div className="ah-3col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        {filtered.map((c, i) => (
          <div
            key={c.id || i}
            className="card"
            style={{ textAlign: 'right', border: '1px solid var(--color-divider)' }}
          >
            <button
              type="button"
              onClick={() => c.id && navigate(`/admin/classes/${c.id}`)}
              style={{
                display: 'block', width: '100%', textAlign: 'right', cursor: c.id ? 'pointer' : 'default',
                background: 'transparent', border: 0, padding: 0, font: 'inherit', color: 'inherit',
              }}
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
            <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyTop: '1px solid var(--line)', paddingTop: 10 }}>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ fontSize: 12 }}
                disabled={demo || !c.id}
                onClick={(e) => { e.stopPropagation(); setEditing(c); }}
              >
                تعديل
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ fontSize: 12, color: 'var(--color-accent-2-700)' }}
                disabled={demo || busyId === c.id}
                onClick={(e) => onDelete(c, e)}
              >
                حذف
              </button>
            </div>
          </div>
        ))}
      </div>
      {showModal && <NewClassModal demo={demo} onClose={() => setShowModal(false)} />}
      {editing && <EditClassModal cls={editing} demo={demo} onClose={() => setEditing(null)} />}
    </div>
  );
}
