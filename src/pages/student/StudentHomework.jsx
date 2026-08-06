import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { where } from 'firebase/firestore';
import { ErrorBanner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useClassDayLogsMap } from '../../hooks/useClassDayLogsMap';
import { useClassDocsMap } from '../../hooks/useClassDocsMap';
import { useClassLessonsMap } from '../../hooks/useClassLessonsMap';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { useMyStudent, useStudentClassIds } from '../../hooks/useMyStudent';
import { isHomeworkLesson } from '../../services/studentPortal';
import { homeworkSubmissionId, markHomeworkSubmitted } from '../../services/homework';
import { demoStudentClasses } from '../../data/demo';

const FILTERS = [
  { id: 'open', label: 'مطلوب' },
  { id: 'done', label: 'تم التسليم' },
  { id: 'all', label: 'الكل' },
];

export default function StudentHomework() {
  const { profile } = useAuth();
  const { enrolled, demo, error, studentId, student } = useMyStudent();
  const classIds = useStudentClassIds(enrolled, demo);
  const lessonsByClass = useClassLessonsMap(demo ? [] : classIds);
  const dayLogsByClass = useClassDayLogsMap(demo ? [] : classIds);
  const classDocs = useClassDocsMap(demo ? [] : classIds);
  const [busyId, setBusyId] = useState(null);
  const [localDone, setLocalDone] = useState({});
  const [filter, setFilter] = useState('open');

  const { data: submissions } = useLiveOrDemo(
    'homeworkSubmissions',
    studentId ? [where('studentId', '==', studentId)] : [where('studentId', '==', '__none__')],
    [],
    studentId,
  );

  const submittedMap = useMemo(() => {
    const map = { ...localDone };
    for (const s of submissions || []) {
      if (s.status === 'تم التسليم') map[s.id] = true;
    }
    return map;
  }, [submissions, localDone]);

  const homework = useMemo(() => {
    if (demo) {
      return [
        {
          id: 'hw-demo-0',
          submissionId: 'demo',
          title: demoStudentClasses[0]?.next || 'تمارين',
          className: demoStudentClasses[0]?.title,
          subject: demoStudentClasses[0]?.subject,
          status: 'مطلوب',
          dueDate: null,
          classId: 'demo',
          teacherId: null,
          sort: Date.now(),
        },
      ];
    }
    const rows = [];

    Object.entries(dayLogsByClass).forEach(([classId, logs]) => {
      const doc = classDocs[classId];
      const meta = (enrolled || []).find((e) => (e.classId || e.id) === classId);
      (logs || [])
        .filter((l) => (l.homework || '').trim())
        .slice(0, 12)
        .forEach((l) => {
          const date = l.date || l.id;
          const sid = homeworkSubmissionId({ studentId, classId, date, source: 'dayLog' });
          rows.push({
            id: `diary-${classId}-${date}`,
            submissionId: sid,
            title: l.homework.trim(),
            className: doc?.title || meta?.title || meta?.className || classId,
            subject: doc?.subject || meta?.subject || '',
            classId,
            teacherId: l.teacherId || doc?.teacherId || null,
            status: submittedMap[sid] ? 'تم التسليم' : 'مطلوب',
            dueDate: date || null,
            teacher: l.teacherName || doc?.teacher || meta?.teacher || '',
            sort: Date.parse(date || '') || 0,
          });
        });
    });

    Object.entries(lessonsByClass).forEach(([classId, lessons]) => {
      const doc = classDocs[classId];
      const meta = (enrolled || []).find((e) => (e.classId || e.id) === classId);
      (lessons || [])
        .filter((l) => (!l.status || l.status === 'منشور' || l.published) && isHomeworkLesson(l))
        .forEach((l) => {
          rows.push({
            id: `lesson-${l.id}`,
            submissionId: null,
            title: l.title,
            className: doc?.title || meta?.title || meta?.className || classId,
            subject: doc?.subject || meta?.subject || '',
            classId,
            status: 'مطلوب',
            dueDate: l.dueDate || null,
            teacher: l.authorName || doc?.teacher || meta?.teacher || '',
            sort: Date.parse(l.dueDate || '') || (l.createdAt?.toMillis?.() || 0),
          });
        });
    });

    return rows.sort((a, b) => b.sort - a.sort);
  }, [demo, dayLogsByClass, lessonsByClass, classDocs, enrolled, studentId, submittedMap]);

  const view = useMemo(() => {
    if (filter === 'open') return homework.filter((h) => h.status !== 'تم التسليم');
    if (filter === 'done') return homework.filter((h) => h.status === 'تم التسليم');
    return homework;
  }, [homework, filter]);

  const markDone = async (hw) => {
    if (!hw.submissionId || hw.submissionId === 'demo' || demo || !studentId) return;
    setBusyId(hw.id);
    try {
      await markHomeworkSubmitted({
        studentId,
        studentName: student?.name || profile?.name,
        classId: hw.classId,
        className: hw.className,
        date: hw.dueDate,
        title: hw.title,
        teacherId: hw.teacherId,
        submittedByUid: profile?.id,
        submittedByName: profile?.name || student?.name,
        submittedByRole: 'student',
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
      <ErrorBanner>{error && 'تعذّر تحميل الواجبات.'}</ErrorBanner>

      <header className="stu-page-head">
        <h1 className="stu-page-title">واجباتي</h1>
        <p className="stu-page-lead">الأحدث أولاً</p>
      </header>

      <div className="stu-filter" role="tablist" aria-label="حالة الواجب">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            className={`stu-filter-btn${filter === f.id ? ' is-on' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {view.length === 0 ? (
        <div className="stu-empty-block">
          <p>{filter === 'done' ? 'ما في واجبات مسلّمة.' : 'ما في واجبات مطلوبة.'}</p>
          <Link to="/student/today" className="stu-section-link">شوف يومك</Link>
        </div>
      ) : (
        <div className="stu-list">
          {view.map((hw) => (
            <div key={hw.id} className="stu-hw-card">
              <div className="stu-hw-body">
                <div className="stu-list-title">{hw.title}</div>
                <div className="stu-list-sub">
                  {[hw.subject, hw.className, hw.teacher].filter(Boolean).join(' · ')}
                </div>
                {hw.dueDate && <div className="stu-list-sub">التاريخ: {hw.dueDate}</div>}
              </div>
              <div className="stu-hw-actions">
                <span className={`stu-status stu-status--${hw.status === 'تم التسليم' ? 'ok' : 'warn'}`}>
                  {hw.status}
                </span>
                {hw.submissionId && hw.status !== 'تم التسليم' && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: 12 }}
                    disabled={busyId === hw.id}
                    onClick={() => markDone(hw)}
                  >
                    تمّ التسليم
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
