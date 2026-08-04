import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import { ErrorBanner } from '../../components/ui';
import { useClassLessonsMap } from '../../hooks/useClassLessonsMap';
import { useMyStudent, useStudentClassIds } from '../../hooks/useMyStudent';
import { demoStudentClasses } from '../../data/demo';

const WEEKDAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export default function StudentToday() {
  const { enrolled, demo, error, gradeLabel } = useMyStudent();
  const classIds = useStudentClassIds(enrolled, demo);
  const lessonsByClass = useClassLessonsMap(demo ? [] : classIds);
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const weekday = WEEKDAYS[today.getDay()];

  const scheduleRows = useMemo(() => {
    if (demo) {
      return demoStudentClasses.map((c, i) => ({
        id: `sch-${i}`,
        title: c.title,
        subject: c.subject,
        when: i === 0 ? 'الحصة القادمة' : 'هذا الأسبوع',
        detail: c.next,
      }));
    }
    const fromEnrolled = (enrolled || []).map((e) => ({
      id: e.id || e.classId,
      title: e.title || e.className,
      subject: e.subject,
      when: e.shift || 'صباحي',
      detail: Array.isArray(e.schedule) ? e.schedule.join(' · ') : (e.teacher || e.teacherName || ''),
    }));
    const scheduledLessons = [];
    Object.entries(lessonsByClass).forEach(([classId, lessons]) => {
      const meta = (enrolled || []).find((e) => (e.classId || e.id) === classId);
      (lessons || [])
        .filter((l) => l.scheduledFor === todayStr || (l.scheduledFor && l.scheduledFor >= todayStr))
        .filter((l) => !l.status || l.status === 'منشور' || l.status === 'مجدول' || l.published)
        .slice(0, 5)
        .forEach((l) => {
          scheduledLessons.push({
            id: `${classId}-${l.id}`,
            title: l.title,
            subject: meta?.subject || 'درس مجدول',
            when: l.scheduledFor === todayStr ? 'اليوم' : l.scheduledFor,
            detail: [l.chapterTitle, l.authorName || meta?.teacher || meta?.teacherName].filter(Boolean).join(' · '),
          });
        });
    });
    return [...scheduledLessons, ...fromEnrolled];
  }, [demo, enrolled, lessonsByClass, todayStr]);

  return (
    <div className="stu-page">
      <ErrorBanner>{error && 'تعذّر تحميل جدولك.'}</ErrorBanner>
      <header className="stu-page-head">
        <h1 className="stu-page-title">اليوم · {weekday}</h1>
        <p className="stu-page-lead">
          {today.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })}
          {gradeLabel ? ` · ${gradeLabel}` : ''}
        </p>
      </header>

      <div className="stu-actions-row">
        <Link to="/student/classes" className="btn btn-primary" style={{ fontSize: 13, textDecoration: 'none' }}>
          <Icon name="menu_book" size={15} /> فتح صفوفي
        </Link>
        <Link to="/student/homework" className="btn btn-secondary" style={{ fontSize: 13, textDecoration: 'none' }}>
          الواجبات
        </Link>
      </div>

      <section className="card">
        <h2 className="card-title" style={{ marginBottom: 12 }}>جدول / حصص مرتبطة</h2>
        {scheduleRows.length === 0 && (
          <p className="stu-empty">لا حصص معروضة اليوم. راجع صفوفك المسجّلة أو انتظر جدولة المعلّم.</p>
        )}
        {scheduleRows.map((row) => (
          <div key={row.id} className="stu-class-row">
            <div className="stu-class-icon"><Icon name="schedule" size={18} /></div>
            <div className="stu-class-body">
              <div className="stu-class-name">{row.title}</div>
              <div className="stu-class-meta">{[row.subject, row.detail].filter(Boolean).join(' · ')}</div>
            </div>
            <span className="tag tag-outline">{row.when}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
