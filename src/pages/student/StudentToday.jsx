import { useMemo } from 'react';
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
        topic: null,
        homework: null,
        notice: null,
      }));
    }
    const classes = classIds.map((id) => classDocs[id]).filter(Boolean);
    const slots = slotsForDay(classes, weekday);
    if (slots.length > 0) {
      return slots.map((row) => {
        const log = todayLogs[row.classId];
        return {
          id: `${row.classId}-${row.start}`,
          title: row.title,
          subject: row.subject,
          when: row.end ? `${row.start} – ${row.end}` : row.start,
          topic: log?.topic || null,
          homework: log?.homework || null,
          notice: log?.notice || null,
        };
      });
    }
    return (enrolled || []).map((e) => {
      const id = e.classId || e.id;
      const doc = classDocs[id];
      const log = todayLogs[id];
      return {
        id,
        title: doc?.title || e.title || e.className,
        subject: doc?.subject || e.subject,
        when: doc?.shift || e.shift || 'صباحي',
        topic: log?.topic || null,
        homework: log?.homework || null,
        notice: log?.notice || null,
      };
    });
  }, [demo, classIds, classDocs, weekday, todayLogs, enrolled]);

  const dateLabel = today.toLocaleDateString('ar-EG', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <div className="stu-page">
      <ErrorBanner>{error && 'تعذّر تحميل جدولك.'}</ErrorBanner>

      <header className="stu-page-head">
        <h1 className="stu-page-title">اليوم</h1>
        <p className="stu-page-lead">
          {dateLabel}{gradeLabel ? ` · ${gradeLabel}` : ''}
        </p>
      </header>

      {scheduleRows.length === 0 ? (
        <div className="stu-empty-block">
          <p>ما في حصص مسجّلة لليوم.</p>
        </div>
      ) : (
        <div className="stu-list">
          {scheduleRows.map((row) => (
            <article key={row.id} className="stu-day-card">
              <div className="stu-day-top">
                <div>
                  <div className="stu-list-title">{row.title}</div>
                  {row.subject && <div className="stu-list-sub">{row.subject}{row.teacherName ? ` · ${row.teacherName}` : ''}</div>}
                </div>
                <span className="stu-day-time" dir="ltr">{row.when}</span>
              </div>
              {(row.topic || row.homework || row.notice) ? (
                <ul className="stu-day-notes">
                  {row.topic && <li><strong>الموضوع:</strong> {row.topic}</li>}
                  {row.homework && <li><strong>الواجب:</strong> {row.homework}</li>}
                  {row.notice && <li className="is-alert"><strong>تنبيه:</strong> {row.notice}</li>}
                </ul>
              ) : (
                <p className="stu-list-sub" style={{ marginTop: 8 }}>ما كتب المعلّم شيء بعد لهذه الحصة.</p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
