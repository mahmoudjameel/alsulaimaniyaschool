import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import { ErrorBanner } from '../../components/ui';
import { useClassDocsMap } from '../../hooks/useClassDocsMap';
import { useTodayDayLogsMap } from '../../hooks/useClassDayLogsMap';
import { useMyStudent, useStudentClassIds } from '../../hooks/useMyStudent';
import { slotsForDay, todaySchoolDay } from '../../lib/schedule';
import { demoStudentClasses } from '../../data/demo';

export default function StudentToday() {
  const { enrolled, demo, error, gradeLabel } = useMyStudent();
  const classIds = useStudentClassIds(enrolled, demo);
  const classDocs = useClassDocsMap(demo ? [] : classIds);
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const weekday = todaySchoolDay(today);
  const todayLogs = useTodayDayLogsMap(demo ? [] : classIds, todayStr);

  const scheduleRows = useMemo(() => {
    if (demo) {
      return demoStudentClasses.map((c, i) => ({
        id: `sch-${i}`,
        title: c.title,
        subject: c.subject,
        when: i === 0 ? '08:00' : 'هذا الأسبوع',
        detail: c.next,
        topic: null,
      }));
    }
    const classes = classIds
      .map((id) => classDocs[id])
      .filter(Boolean);
    const slots = slotsForDay(classes, weekday);
    if (slots.length > 0) {
      return slots.map((row) => {
        const log = todayLogs[row.classId];
        return {
          id: `${row.classId}-${row.start}`,
          classId: row.classId,
          title: row.title,
          subject: row.subject,
          when: row.end ? `${row.start} – ${row.end}` : row.start,
          detail: [row.grade, row.shift].filter(Boolean).join(' · '),
          topic: log?.topic || null,
          homework: log?.homework || null,
          notice: log?.notice || null,
        };
      });
    }
    // Fallback: enrolled classes with today's diary even if no schedule slots
    return (enrolled || []).map((e) => {
      const id = e.classId || e.id;
      const doc = classDocs[id];
      const log = todayLogs[id];
      return {
        id,
        classId: id,
        title: doc?.title || e.title || e.className,
        subject: doc?.subject || e.subject,
        when: doc?.shift || e.shift || 'صباحي',
        detail: doc?.teacher || e.teacher || e.teacherName || '',
        topic: log?.topic || null,
        homework: log?.homework || null,
        notice: log?.notice || null,
      };
    });
  }, [demo, classIds, classDocs, weekday, todayLogs, enrolled]);

  const diaryCards = useMemo(() => {
    if (demo) {
      return [{
        id: 'demo-diary',
        title: demoStudentClasses[0]?.title || 'صف',
        subject: demoStudentClasses[0]?.subject,
        topic: 'مراجعة الحروف',
        homework: 'حل تمارين الصفحة 12',
        notice: 'إحضار دفتر الإملاء غداً',
      }];
    }
    return classIds
      .map((id) => {
        const log = todayLogs[id];
        if (!log || (!log.topic && !log.homework && !log.notice)) return null;
        const doc = classDocs[id];
        const meta = (enrolled || []).find((e) => (e.classId || e.id) === id);
        return {
          id,
          title: doc?.title || meta?.title || meta?.className || 'صف',
          subject: doc?.subject || meta?.subject,
          topic: log.topic,
          homework: log.homework,
          notice: log.notice,
          teacher: log.teacherName || doc?.teacher,
        };
      })
      .filter(Boolean);
  }, [demo, classIds, todayLogs, classDocs, enrolled]);

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
        <Link to="/student/homework" className="btn btn-primary" style={{ fontSize: 13, textDecoration: 'none' }}>
          <Icon name="assignment" size={15} /> الواجبات
        </Link>
        <Link to="/student/grades" className="btn btn-secondary" style={{ fontSize: 13, textDecoration: 'none' }}>
          الدرجات
        </Link>
        <Link to="/student/classes" className="btn btn-secondary" style={{ fontSize: 13, textDecoration: 'none' }}>
          صفوفي
        </Link>
      </div>

      <section className="card">
        <h2 className="card-title" style={{ marginBottom: 12 }}>حصص اليوم</h2>
        {scheduleRows.length === 0 && (
          <p className="stu-empty">لا حصص مجدولة لك اليوم. راجع صفوفك أو انتظر ضبط الجدول من الإدارة.</p>
        )}
        {scheduleRows.map((row) => (
          <div key={row.id} className="stu-class-row">
            <div className="stu-class-icon"><Icon name="schedule" size={18} /></div>
            <div className="stu-class-body">
              <div className="stu-class-name">{row.title}</div>
              <div className="stu-class-meta">{[row.subject, row.detail].filter(Boolean).join(' · ')}</div>
              {row.topic && <div className="stu-class-meta" style={{ marginTop: 4 }}>موضوع الحصة: {row.topic}</div>}
            </div>
            <span className="tag tag-outline" dir="ltr">{row.when}</span>
          </div>
        ))}
      </section>

      <section className="card">
        <h2 className="card-title" style={{ marginBottom: 12 }}>دفتر اليوم من المعلّم</h2>
        {diaryCards.length === 0 && (
          <p className="stu-empty">لم يُسجّل المعلّم موضوعاً أو واجباً أو تنبيهاً لهذا اليوم بعد.</p>
        )}
        {diaryCards.map((d) => (
          <div key={d.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
            <div className="stu-class-name">{d.title}</div>
            <div className="stu-class-meta" style={{ marginBottom: 8 }}>
              {[d.subject, d.teacher].filter(Boolean).join(' · ')}
            </div>
            {d.topic && (
              <div style={{ fontSize: 13, marginBottom: 6 }}>
                <strong>الموضوع:</strong> {d.topic}
              </div>
            )}
            {d.homework && (
              <div style={{ fontSize: 13, marginBottom: 6 }}>
                <strong>الواجب:</strong> {d.homework}
              </div>
            )}
            {d.notice && (
              <div style={{ fontSize: 13, color: 'var(--color-accent-800)' }}>
                <strong>تنبيه:</strong> {d.notice}
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
