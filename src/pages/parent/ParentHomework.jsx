import { useMemo, useState } from 'react';
import { where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { ErrorBanner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useMyChildren } from '../../hooks/useMyChildren';
import { useClassDayLogsMap } from '../../hooks/useClassDayLogsMap';
import { useClassDocsMap } from '../../hooks/useClassDocsMap';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { homeworkSubmissionId, markHomeworkSubmitted } from '../../services/homework';

export default function ParentHomework() {
  const { profile } = useAuth();
  const { children, error, demo } = useMyChildren();
  const [childId, setChildId] = useState('');
  const activeChild = children.find((c) => c.id === (childId || children[0]?.id)) || children[0];
  const studentId = activeChild?.id;

  const { data: enrolled } = useLiveOrDemo(
    studentId ? `students/${studentId}/classes` : '__none__',
    [],
    [],
    studentId,
  );
  const classIds = useMemo(() => (enrolled || []).map((e) => e.classId || e.id).filter(Boolean), [enrolled]);
  const dayLogsByClass = useClassDayLogsMap(demo ? [] : classIds);
  const classDocs = useClassDocsMap(demo ? [] : classIds);

  const { data: submissions } = useLiveOrDemo(
    'homeworkSubmissions',
    studentId ? [where('studentId', '==', studentId)] : [where('studentId', '==', '__none__')],
    [],
    studentId,
  );
  const submittedSet = useMemo(() => new Set((submissions || []).filter((s) => s.status === 'تم التسليم').map((s) => s.id)), [submissions]);
  const [busyId, setBusyId] = useState(null);
  const [localDone, setLocalDone] = useState({});

  const homework = useMemo(() => {
    if (demo) {
      return [{ id: 'demo', title: 'واجب عرض توضيحي', className: 'صف تجريبي', dueDate: null, submissionId: null }];
    }
    const rows = [];
    Object.entries(dayLogsByClass).forEach(([classId, logs]) => {
      const doc = classDocs[classId];
      const meta = (enrolled || []).find((e) => (e.classId || e.id) === classId);
      (logs || []).filter((l) => (l.homework || '').trim()).slice(0, 12).forEach((l) => {
        const date = l.date || l.id;
        const sid = homeworkSubmissionId({ studentId, classId, date, source: 'dayLog' });
        rows.push({
          id: sid,
          submissionId: sid,
          title: l.homework.trim(),
          className: doc?.title || meta?.title || classId,
          subject: doc?.subject || meta?.subject || '',
          classId,
          teacherId: l.teacherId || doc?.teacherId,
          dueDate: date,
          done: submittedSet.has(sid) || localDone[sid],
          sort: Date.parse(date || '') || 0,
        });
      });
    });
    return rows.sort((a, b) => b.sort - a.sort);
  }, [demo, dayLogsByClass, classDocs, enrolled, studentId, submittedSet, localDone]);

  const markDone = async (hw) => {
    if (!hw.submissionId || demo || !studentId) return;
    setBusyId(hw.id);
    try {
      await markHomeworkSubmitted({
        studentId,
        studentName: activeChild?.name,
        classId: hw.classId,
        className: hw.className,
        date: hw.dueDate,
        title: hw.title,
        teacherId: hw.teacherId,
        submittedByUid: profile?.id,
        submittedByName: profile?.name,
        submittedByRole: 'parent',
      });
      setLocalDone((p) => ({ ...p, [hw.submissionId]: true }));
    } catch {
      window.alert('تعذّر تسجيل التسليم.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="stu-page">
      <ErrorBanner>{error && 'تعذّر التحميل.'}</ErrorBanner>
      <header className="stu-page-head">
        <h1 className="stu-page-title">واجبات الأبناء</h1>
        <p className="stu-page-lead">من دفتر يوم المعلّم — يمكن تعليم «تمّ التسليم» اختيارياً.</p>
      </header>

      {children.length > 1 && (
        <div className="field" style={{ maxWidth: 280, marginBottom: 12 }}>
          <label>الابن/ة</label>
          <select className="input" value={activeChild?.id || ''} onChange={(e) => setChildId(e.target.value)}>
            {children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      {homework.length === 0 && (
        <div className="card stu-empty-card">
          <Icon name="assignment" size={28} color="var(--gold)" />
          <p>لا واجبات من دفتر اليوم حالياً.</p>
        </div>
      )}

      {homework.map((hw) => (
        <div key={hw.id} className="card stu-hw-row">
          <div className="stu-class-icon"><Icon name="assignment" size={18} /></div>
          <div style={{ flex: 1 }}>
            <div className="stu-class-name">{hw.title}</div>
            <div className="stu-class-meta">{[hw.subject, hw.className, hw.dueDate].filter(Boolean).join(' · ')}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            <span className={`tag tag-${hw.done ? 'accent' : 'outline'}`}>{hw.done ? 'تم التسليم' : 'مطلوب'}</span>
            {!hw.done && hw.submissionId && (
              <button type="button" className="btn btn-secondary" style={{ fontSize: 11 }} disabled={busyId === hw.id} onClick={() => markDone(hw)}>
                تمّ التسليم
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
