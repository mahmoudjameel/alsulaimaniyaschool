import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { orderBy, where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { ErrorBanner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
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

const FILTERS = [
  { id: 'all', label: 'الكل' },
  { id: 'today', label: 'اليوم' },
  { id: 'grades', label: 'درجات' },
  { id: 'absence', label: 'غياب' },
];

export default function StudentInbox() {
  const { profile } = useAuth();
  const { student, studentId, enrolled, demo, error: stuErr } = useMyStudent();
  const classIds = useStudentClassIds(enrolled, demo);
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayLogs = useTodayDayLogsMap(demo ? [] : classIds, todayStr);
  const classDocs = useClassDocsMap(demo ? [] : classIds);
  const [filter, setFilter] = useState('all');

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
    [where('status', '==', 'منشور'), orderBy('createdAt', 'desc')],
    demoAnnouncements.filter((a) => a.status === 'منشور'),
  );
  const { data: pushNotes } = useLiveOrDemo(
    'notifications',
    [where('userId', '==', profile?.id || '__none__'), orderBy('createdAt', 'desc')],
    [],
    profile?.id || '__none__',
  );

  const items = useMemo(() => {
    const out = [];

    (pushNotes || []).slice(0, 12).forEach((n) => {
      out.push({
        id: `push-${n.id}`,
        kind: 'push',
        icon: n.type?.includes('exam') ? 'event' : n.type?.includes('grade') ? 'grade' : 'notifications',
        title: n.title || 'تنبيه',
        meta: n.body || '',
        to: n.link || '/student/inbox',
        sort: n.createdAt?.toMillis?.() || 0,
        time: relativeFromTimestamp(n.createdAt),
      });
    });

    Object.entries(todayLogs || {}).forEach(([classId, log]) => {
      if (!log) return;
      const doc = classDocs[classId];
      const meta = (enrolled || []).find((e) => (e.classId || e.id) === classId);
      const className = doc?.title || meta?.title || meta?.className || 'صف';
      if (log.notice) {
        out.push({
          id: `notice-${classId}-${todayStr}`,
          kind: 'today',
          icon: 'campaign',
          title: `تنبيه — ${className}`,
          meta: log.notice,
          to: '/student/today',
          sort: Date.now(),
          time: 'اليوم',
        });
      }
      if (log.homework) {
        out.push({
          id: `hw-${classId}-${todayStr}`,
          kind: 'today',
          icon: 'assignment',
          title: `واجب — ${className}`,
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
        kind: 'grades',
        icon: 'grade',
        title: g.assessmentTitle || 'درجة جديدة',
        meta: [g.subject, `${g.score}/${g.maxScore}`].filter(Boolean).join(' · '),
        to: '/student/grades',
        sort: g.createdAt?.toMillis?.() || g.decidedAt?.toMillis?.() || 0,
        time: relativeFromTimestamp(g.createdAt) || relativeFromTimestamp(g.decidedAt),
      });
    });

    (attendance || []).filter((r) => r.status === 'غائب' || r.status === 'متأخر').slice(0, 6).forEach((r) => {
      out.push({
        id: `a-${r.id || r.date}`,
        kind: 'absence',
        icon: 'event_busy',
        title: r.status === 'غائب' ? `غياب ${r.date}` : `تأخّر ${r.date}`,
        meta: r.className || r.subject || '',
        to: '/student/attendance',
        sort: Date.parse(r.date || '') || 0,
        time: r.date,
      });
    });

    (notes || []).slice(0, 5).forEach((n, i) => {
      out.push({
        id: `n-${n.id || i}`,
        kind: 'push',
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
        kind: 'push',
        icon: 'campaign',
        title: a.title,
        meta: a.audience || '',
        to: '/student/announcements',
        sort: a.createdAt?.toMillis?.() || 0,
        time: a.date || relativeFromTimestamp(a.createdAt),
      });
    });

    return out.sort((a, b) => b.sort - a.sort).slice(0, 30);
  }, [grades, attendance, notes, announcements, student, todayLogs, classDocs, enrolled, todayStr, pushNotes]);

  const view = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((i) => i.kind === filter);
  }, [items, filter]);

  return (
    <div className="stu-page">
      <ErrorBanner>{stuErr && 'تعذّر تحميل التنبيهات.'}</ErrorBanner>

      <header className="stu-page-head">
        <h1 className="stu-page-title">تنبيهاتي</h1>
        <p className="stu-page-lead">الأحدث أولاً</p>
      </header>

      <div className="stu-filter" role="tablist" aria-label="نوع التنبيه">
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
          <Icon name="notifications" size={28} color="var(--gold)" />
          <p>ما في تنبيهات.</p>
        </div>
      ) : (
        <div className="stu-list">
          {view.map((item) => (
            <Link key={item.id} to={item.to} className="stu-list-row stu-list-link">
              <div className="stu-list-icon"><Icon name={item.icon} size={18} /></div>
              <div className="stu-list-main">
                <div className="stu-list-title">{item.title}</div>
                {item.meta && <div className="stu-list-sub">{item.meta}</div>}
              </div>
              <span className="stu-list-time">{item.time}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
