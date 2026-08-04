import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { orderBy, where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { ErrorBanner } from '../../components/ui';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { useTodayDayLogsMap } from '../../hooks/useClassDayLogsMap';
import { useClassDocsMap } from '../../hooks/useClassDocsMap';
import { filterStudentAnnouncements, useMyStudent, useStudentClassIds } from '../../hooks/useMyStudent';
import { relativeFromTimestamp, relativeHoursAr } from '../../lib/relativeTime';
import {
  demoAnnouncements,
  demoAttendanceRecords,
  demoGradeEntries,
  demoStudentDetail,
} from '../../data/demo';

export default function StudentInbox() {
  const { student, studentId, enrolled, demo, error: stuErr } = useMyStudent();
  const classIds = useStudentClassIds(enrolled, demo);
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayLogs = useTodayDayLogsMap(demo ? [] : classIds, todayStr);
  const classDocs = useClassDocsMap(demo ? [] : classIds);

  const { data: gradesRaw } = useLiveOrDemo(
    'gradeEntries',
    [where('studentId', '==', studentId || '__none__')],
    demoGradeEntries.filter((g) => g.studentId === 's1' && g.status === 'معتمد'),
    studentId || '__none__',
  );
  const grades = (gradesRaw || []).filter((g) => g.status === 'معتمد');
  const { data: attendance } = useLiveOrDemo(
    `students/${studentId || '__none__'}/attendanceRecords`,
    [orderBy('date', 'desc')],
    demoAttendanceRecords.s1 || [],
    studentId || '__none__',
  );
  const { data: notes } = useLiveOrDemo(
    `students/${studentId || '__none__'}/notes`,
    [orderBy('createdAt', 'desc')],
    demoStudentDetail.s1?.notes || [],
    studentId || '__none__',
  );
  const { data: announcements } = useLiveOrDemo(
    'announcements',
    [orderBy('createdAt', 'desc')],
    demoAnnouncements,
  );

  const items = useMemo(() => {
    const out = [];

    Object.entries(todayLogs || {}).forEach(([classId, log]) => {
      if (!log) return;
      const doc = classDocs[classId];
      const meta = (enrolled || []).find((e) => (e.classId || e.id) === classId);
      const className = doc?.title || meta?.title || meta?.className || 'صف';
      if (log.notice) {
        out.push({
          id: `notice-${classId}-${todayStr}`,
          icon: 'campaign',
          title: `تنبيه صف: ${className}`,
          meta: log.notice,
          to: '/student/today',
          sort: Date.now(),
          time: 'اليوم',
        });
      }
      if (log.homework) {
        out.push({
          id: `hw-${classId}-${todayStr}`,
          icon: 'assignment',
          title: `واجب اليوم — ${className}`,
          meta: log.homework,
          to: '/student/homework',
          sort: Date.now() - 1,
          time: 'اليوم',
        });
      }
    });

    (grades || []).slice(0, 8).forEach((g) => {
      out.push({
        id: `g-${g.id}`,
        icon: 'grade',
        title: `درجة معتمدة: ${g.assessmentTitle || 'تقييم'}`,
        meta: [g.assessmentType, g.subject, `${g.score}/${g.maxScore}`].filter(Boolean).join(' · '),
        to: '/student/grades',
        sort: g.createdAt?.toMillis?.() || g.decidedAt?.toMillis?.() || 0,
        time: relativeFromTimestamp(g.createdAt) || relativeFromTimestamp(g.decidedAt),
      });
    });
    (attendance || []).filter((r) => r.status === 'غائب' || r.status === 'متأخر').slice(0, 6).forEach((r) => {
      out.push({
        id: `a-${r.id || r.date}`,
        icon: 'event_busy',
        title: r.status === 'غائب' ? `غياب بتاريخ ${r.date}` : `تأخّر بتاريخ ${r.date}`,
        meta: r.className || r.subject || '',
        to: '/student/attendance',
        sort: Date.parse(r.date || '') || 0,
        time: r.date,
      });
    });
    (notes || []).slice(0, 5).forEach((n, i) => {
      out.push({
        id: `n-${n.id || i}`,
        icon: 'chat',
        title: 'ملاحظة من المعلّم',
        meta: String(n.note || '').slice(0, 80),
        to: '/student/notes',
        sort: n.createdAt?.toMillis?.() || (n.daysAgo != null ? Date.now() - n.daysAgo * 864e5 : 0),
        time: n.daysAgo != null ? relativeHoursAr(n.daysAgo * 24) : relativeFromTimestamp(n.createdAt),
      });
    });
    filterStudentAnnouncements(announcements, student).slice(0, 5).forEach((a, i) => {
      out.push({
        id: `an-${a.id || i}`,
        icon: 'campaign',
        title: a.title,
        meta: a.audience || '',
        to: '/student/announcements',
        sort: a.createdAt?.toMillis?.() || 0,
        time: a.date || relativeFromTimestamp(a.createdAt),
      });
    });
    return out.sort((a, b) => b.sort - a.sort).slice(0, 25);
  }, [grades, attendance, notes, announcements, student, todayLogs, classDocs, enrolled, todayStr]);

  return (
    <div className="stu-page">
      <ErrorBanner>{stuErr && 'تعذّر تحميل التنبيهات.'}</ErrorBanner>
      <header className="stu-page-head">
        <h1 className="stu-page-title">تنبيهاتي</h1>
        <p className="stu-page-lead">واجبات وتنبيهات دفتر اليوم، درجات، غياب، ملاحظات، وإعلانات.</p>
      </header>

      {items.length === 0 && (
        <div className="card stu-empty-card">
          <Icon name="notifications" size={28} color="var(--gold)" />
          <p>لا تنبيهات جديدة.</p>
        </div>
      )}

      {items.map((item) => (
        <Link key={item.id} to={item.to} className="card stu-inbox-item">
          <div className="stu-class-icon"><Icon name={item.icon} size={18} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="stu-class-name">{item.title}</div>
            <div className="stu-class-meta">{item.meta}</div>
          </div>
          <span className="stu-feed-time">{item.time}</span>
        </Link>
      ))}
    </div>
  );
}
