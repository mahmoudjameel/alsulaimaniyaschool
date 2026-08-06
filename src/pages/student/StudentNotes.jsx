import { orderBy } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { ErrorBanner } from '../../components/ui';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { useMyStudent } from '../../hooks/useMyStudent';
import { relativeFromTimestamp } from '../../lib/relativeTime';
import { demoStudentDetail } from '../../data/demo';

export default function StudentNotes() {
  const { studentId, error: stuErr, demo } = useMyStudent();
  const demoNotes = (demoStudentDetail.s1?.notes || []).map((n, i) => ({
    id: `dn-${i}`,
    ...n,
    by: n.by || 'المعلّم',
    visibleToParent: true,
  }));

  const { data: notes, error } = useLiveOrDemo(
    `students/${studentId || '__none__'}/notes`,
    [orderBy('createdAt', 'desc')],
    demoNotes,
    studentId || '__none__',
  );

  const visible = (notes || []).filter((n) => n.visibleToStudent !== false);

  return (
    <div className="stu-page">
      <ErrorBanner>{(stuErr || error) && 'تعذّر تحميل الملاحظات.'}</ErrorBanner>

      <header className="stu-page-head">
        <h1 className="stu-page-title">ملاحظات</h1>
        <p className="stu-page-lead">من معلّميك · الأحدث أولاً</p>
      </header>

      {visible.length === 0 ? (
        <div className="stu-empty-block">
          <Icon name="chat" size={28} color="var(--gold)" />
          <p>ما في ملاحظات بعد.</p>
        </div>
      ) : (
        <div className="stu-list">
          {visible.map((n) => (
            <article key={n.id} className="stu-note-card">
              <div className="stu-note-top">
                <span className="stu-list-sub">
                  {[n.by || n.authorName, n.className].filter(Boolean).join(' · ') || 'المعلّم'}
                </span>
                <span className="stu-list-time">
                  {n.daysAgo != null ? `قبل ${n.daysAgo} يوم` : relativeFromTimestamp(n.createdAt)}
                </span>
              </div>
              <p className="stu-note-text">{n.note || n.text}</p>
            </article>
          ))}
        </div>
      )}
      {demo && <p className="stu-list-sub">عرض توضيحي</p>}
    </div>
  );
}
