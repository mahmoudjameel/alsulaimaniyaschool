import { useEffect, useState } from 'react';
import { orderBy } from 'firebase/firestore';
import ChildSwitcher from '../../components/ChildSwitcher';
import Icon from '../../components/Icon';
import { ErrorBanner } from '../../components/ui';
import { useMyChildren } from '../../hooks/useMyChildren';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { relativeFromTimestamp } from '../../lib/relativeTime';
import { demoStudentDetail } from '../../data/demo';

export default function ParentNotes() {
  const { children, error: childErr, demo } = useMyChildren();
  const [selectedId, setSelectedId] = useState(children[0]?.id || '');

  useEffect(() => {
    if (children.length && !children.some((c) => c.id === selectedId)) {
      setSelectedId(children[0].id);
    }
  }, [children, selectedId]);

  const activeId = selectedId || children[0]?.id;
  const active = children.find((c) => c.id === activeId) || children[0];

  const demoNotes = ((demoStudentDetail[activeId] || demoStudentDetail.s1)?.notes || []).map((n, i) => ({
    id: `dn-${i}`,
    ...n,
    visibleToParent: true,
  }));

  const { data: notes, error } = useLiveOrDemo(
    `students/${activeId || '__none__'}/notes`,
    [orderBy('createdAt', 'desc')],
    demoNotes,
    activeId || '__none__',
  );

  const visible = (notes || []).filter((n) => n.visibleToParent === true);

  return (
    <div className="stu-page">
      <ErrorBanner>{(childErr || error) && 'تعذّر تحميل الملاحظات.'}</ErrorBanner>
      <header className="stu-page-head">
        <h1 className="stu-page-title">ملاحظات المعلّمين</h1>
        <p className="stu-page-lead">ملاحظات يشاركها المعلّم مع ولي الأمر فقط.</p>
      </header>

      <ChildSwitcher children={children} selectedId={activeId} onChange={setSelectedId} />

      {!active && (
        <div className="card stu-empty-card">
          <Icon name="chat" size={28} color="var(--gold)" />
          <p>لا أبناء مرتبطون.</p>
        </div>
      )}

      {active && visible.length === 0 && (
        <div className="card stu-empty-card">
          <Icon name="chat" size={28} color="var(--gold)" />
          <p>لا ملاحظات مشاركة معك حالياً عن {active.name}.</p>
        </div>
      )}

      {visible.map((n) => (
        <article key={n.id} className="card stu-note">
          <div className="stu-note-meta">
            <span className="tag tag-outline">{n.kind || 'ملاحظة'}</span>
            {n.sentiment && <span className="tag tag-neutral">{n.sentiment}</span>}
            <span className="stu-feed-time" style={{ marginInlineStart: 'auto' }}>
              {n.daysAgo != null ? `قبل ${n.daysAgo} يوم` : relativeFromTimestamp(n.createdAt)}
            </span>
          </div>
          <p className="stu-note-text">{n.note || n.text}</p>
          <div className="stu-class-meta">
            {[n.by || n.authorName, n.className, active?.name].filter(Boolean).join(' · ')}
          </div>
        </article>
      ))}
      {demo && <p className="stu-class-meta">وضع العرض التوضيحي.</p>}
    </div>
  );
}
