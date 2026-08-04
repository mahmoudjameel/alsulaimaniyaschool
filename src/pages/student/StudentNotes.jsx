import { orderBy } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { ErrorBanner } from '../../components/ui';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { useMyStudent } from '../../hooks/useMyStudent';
import { relativeFromTimestamp } from '../../lib/relativeTime';
import { demoStudentDetail } from '../../data/demo';

export default function StudentNotes() {
  const { studentId, displayName, error: stuErr, demo } = useMyStudent();
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
      <ErrorBanner>{(stuErr || error) && 'تعذّر تحميل ملاحظات المعلّمين.'}</ErrorBanner>
      <header className="stu-page-head">
        <h1 className="stu-page-title">ملاحظات المعلّمين</h1>
        <p className="stu-page-lead">تشجيع، متابعة دراسية، أو تنبيهات موجّهة لـ {displayName}.</p>
      </header>

      {visible.length === 0 && (
        <div className="card stu-empty-card">
          <Icon name="chat" size={28} color="var(--gold)" />
          <p>لا ملاحظات حالياً — ستظهر هنا عندما يكتب معلّمك ملاحظة.</p>
        </div>
      )}

      {visible.map((n) => {
        const toneLabel = n.sentiment === 'إيجابي'
          ? 'تشجيع'
          : n.sentiment === 'محايد'
            ? 'محايد'
            : 'متابعة';
        const kindLabel = n.kind === 'سلوكي'
          ? 'سلوك'
          : n.kind === 'صحّي'
            ? 'صحّة'
            : n.kind === 'اجتماعي'
              ? 'اجتماعي'
              : n.kind === 'أكاديمي'
                ? 'دراسي'
                : (n.kind || 'ملاحظة');
        return (
          <article key={n.id} className="card stu-note">
            <div className="stu-note-meta">
              <span className="tag tag-outline">{kindLabel}</span>
              <span className={`tag ${n.sentiment === 'إيجابي' ? 'tag-accent' : 'tag-neutral'}`}>{toneLabel}</span>
              <span className="stu-feed-time" style={{ marginInlineStart: 'auto' }}>
                {n.daysAgo != null ? `قبل ${n.daysAgo} يوم` : relativeFromTimestamp(n.createdAt)}
              </span>
            </div>
            <p className="stu-note-text">{n.note || n.text}</p>
            <div className="stu-class-meta">
              {[n.by || n.authorName, n.className].filter(Boolean).join(' · ')}
            </div>
          </article>
        );
      })}
      {demo && <p className="stu-class-meta">وضع العرض التوضيحي.</p>}
    </div>
  );
}
