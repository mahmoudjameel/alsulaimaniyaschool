import { useMemo, useState } from 'react';
import { where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { ErrorBanner } from '../../components/ui';
import { useMyChildren } from '../../hooks/useMyChildren';
import { useLiveOrDemo } from '../../hooks/useFirestore';

/** Shared approved exams list for parent or student portals. */
export function ApprovedExamsList({ classIds, demo }) {
  const { data: exams, error } = useLiveOrDemo(
    'classExams',
    [where('status', '==', 'معتمد')],
    [],
  );

  const list = useMemo(() => {
    const set = new Set(classIds || []);
    return (exams || [])
      .filter((e) => set.size === 0 || set.has(e.classId))
      .sort((a, b) => String(a.examDate).localeCompare(String(b.examDate)));
  }, [exams, classIds]);

  if (error) return <ErrorBanner>تعذّر تحميل الاختبارات.</ErrorBanner>;

  return (
    <>
      {demo && <p className="stu-empty">عرض توضيحي — اربط Firebase لرؤية المواعيد المعتمدة.</p>}
      {list.length === 0 && (
        <div className="card stu-empty-card">
          <Icon name="event" size={28} color="var(--gold)" />
          <p>لا مواعيد اختبارات معتمدة حالياً.</p>
        </div>
      )}
      {list.map((ex) => (
        <div key={ex.id} className="card stu-class-row">
          <div className="stu-class-icon"><Icon name="quiz" size={16} /></div>
          <div className="stu-class-body">
            <div className="stu-class-name">{ex.title}</div>
            <div className="stu-class-meta">
              {[ex.className, ex.subject, ex.examDate, [ex.startTime, ex.endTime].filter(Boolean).join('–')].filter(Boolean).join(' · ')}
            </div>
            {ex.notes && <div className="stu-class-meta" style={{ marginTop: 4 }}>{ex.notes}</div>}
          </div>
          <span className="tag tag-accent">معتمد</span>
        </div>
      ))}
    </>
  );
}

export default function ParentExams() {
  const { children, error, demo } = useMyChildren();
  const [childId, setChildId] = useState('');
  const activeChild = children.find((c) => c.id === (childId || children[0]?.id)) || children[0];
  const { data: enrolled } = useLiveOrDemo(
    activeChild?.id ? `students/${activeChild.id}/classes` : '__none__',
    [],
    [],
    activeChild?.id,
  );
  const classIds = useMemo(() => (enrolled || []).map((e) => e.classId || e.id).filter(Boolean), [enrolled]);

  return (
    <div className="stu-page">
      <ErrorBanner>{error && 'تعذّر التحميل.'}</ErrorBanner>
      <header className="stu-page-head">
        <h1 className="stu-page-title">مواعيد الاختبارات</h1>
        <p className="stu-page-lead">تظهر بعد اعتماد الإدارة من تقويم المعلّم.</p>
      </header>
      {children.length > 1 && (
        <div className="field" style={{ maxWidth: 280, marginBottom: 12 }}>
          <label>الابن/ة</label>
          <select className="input" value={activeChild?.id || ''} onChange={(e) => setChildId(e.target.value)}>
            {children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}
      <ApprovedExamsList classIds={classIds} demo={demo} />
    </div>
  );
}
