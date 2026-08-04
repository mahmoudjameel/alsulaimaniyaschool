import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import { ErrorBanner } from '../../components/ui';
import { useClassLessonsMap } from '../../hooks/useClassLessonsMap';
import { useMyStudent, useStudentClassIds } from '../../hooks/useMyStudent';
import { isHomeworkLesson } from '../../services/studentPortal';
import { demoStudentClasses } from '../../data/demo';

export default function StudentHomework() {
  const { enrolled, demo, error, studentId } = useMyStudent();
  const classIds = useStudentClassIds(enrolled, demo);
  const lessonsByClass = useClassLessonsMap(demo ? [] : classIds);

  const homework = useMemo(() => {
    if (demo) {
      return demoStudentClasses.map((c, i) => ({
        id: `hw-${i}`,
        title: `واجب: ${c.next}`,
        className: c.title,
        subject: c.subject,
        status: 'مطلوب',
        dueDate: null,
      }));
    }
    const rows = [];
    Object.entries(lessonsByClass).forEach(([classId, lessons]) => {
      const meta = (enrolled || []).find((e) => (e.classId || e.id) === classId);
      (lessons || [])
        .filter((l) => (!l.status || l.status === 'منشور' || l.published) && isHomeworkLesson(l))
        .forEach((l) => {
          rows.push({
            id: l.id,
            title: l.title,
            className: meta?.title || meta?.className || classId,
            subject: meta?.subject || '',
            classId,
            status: 'مطلوب',
            summary: l.summary || l.whatTaught || l.notes || '',
            dueDate: l.dueDate || null,
            teacher: l.authorName || meta?.teacher || meta?.teacherName || '',
          });
        });
    });
    return rows;
  }, [demo, lessonsByClass, enrolled]);

  return (
    <div className="stu-page">
      <ErrorBanner>{error && 'تعذّر تحميل الواجبات.'}</ErrorBanner>
      <header className="stu-page-head">
        <h1 className="stu-page-title">واجباتي</h1>
        <p className="stu-page-lead">واجبات يحدّدها معلّموك من بناء الدروس (علامة «واجب»).</p>
      </header>

      {homework.length === 0 && (
        <div className="card stu-empty-card">
          <Icon name="task" size={28} color="var(--gold)" />
          <p>لا واجبات معلّمة حالياً.</p>
          <Link to="/student/classes" className="btn btn-secondary" style={{ fontSize: 13, textDecoration: 'none' }}>تصفّح الدروس</Link>
        </div>
      )}

      {homework.map((hw) => (
        <div key={hw.id} className="card stu-hw-row">
          <div className="stu-class-icon"><Icon name="assignment" size={18} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="stu-class-name">{hw.title}</div>
            <div className="stu-class-meta">
              {[hw.subject, hw.className, hw.teacher].filter(Boolean).join(' · ')}
            </div>
            {hw.dueDate && <div className="stu-class-meta" style={{ marginTop: 2 }}>التسليم: {hw.dueDate}</div>}
            {hw.summary && <div className="stu-class-meta" style={{ marginTop: 4 }}>{hw.summary}</div>}
          </div>
          <span className="tag tag-outline">{hw.status}</span>
          {hw.classId && (
            <Link to="/student/classes" className="btn btn-ghost" style={{ fontSize: 12, textDecoration: 'none' }}>الصف</Link>
          )}
        </div>
      ))}
      {!demo && studentId && classIds.length === 0 && (
        <p className="stu-class-meta">لا صفوف مسجّلة بعد.</p>
      )}
    </div>
  );
}
