import { orderBy } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { EmptyRow, ErrorBanner } from '../../components/ui';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { useMyStudent } from '../../hooks/useMyStudent';
import { computeAttendanceRate, computeMonthlyAttendance } from '../../lib/attendance';
import { demoAttendanceRecords } from '../../data/demo';

const STATUS_TONE = {
  حاضر: 'accent', غائب: 'accent2', متأخر: 'outline', مستأذن: 'neutral',
};

export default function StudentAttendance() {
  const { studentId, displayName, error: stuErr } = useMyStudent();
  const { data: records, error } = useLiveOrDemo(
    `students/${studentId || '__none__'}/attendanceRecords`,
    [orderBy('date', 'desc')],
    demoAttendanceRecords.s1 || [],
    studentId || '__none__',
  );

  const monthly = computeMonthlyAttendance(records);
  const rate = computeAttendanceRate(records);
  const recent = (records || []).slice(0, 40);

  return (
    <div className="stu-page">
      <ErrorBanner>{(stuErr || error) && 'تعذّر تحميل سجل الحضور.'}</ErrorBanner>
      <header className="stu-page-head">
        <h1 className="stu-page-title">حضوري وغيابي</h1>
        <p className="stu-page-lead">سجل المواظبة لـ {displayName}</p>
      </header>

      <div className="stu-hero-stats stu-hero-stats--wide">
        <div className="stu-stat">
          <span className="stu-stat-val">{rate != null ? `${rate}%` : '—'}</span>
          <span className="stu-stat-lbl">نسبة الحضور</span>
        </div>
        <div className="stu-stat">
          <span className="stu-stat-val">{(records || []).filter((r) => r.status === 'غائب').length}</span>
          <span className="stu-stat-lbl">أيام غياب</span>
        </div>
        <div className="stu-stat">
          <span className="stu-stat-val">{(records || []).length}</span>
          <span className="stu-stat-lbl">أيام مسجّلة</span>
        </div>
      </div>

      <section className="card ah-table-wrap" style={{ padding: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
          <h2 className="card-title" style={{ margin: 0 }}>ملخص شهري</h2>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>الشهر</th>
              <th>حاضر</th>
              <th>غائب</th>
              <th>متأخر</th>
              <th>مستأذن</th>
              <th>النسبة</th>
            </tr>
          </thead>
          <tbody>
            {monthly.length === 0 && <EmptyRow colSpan={6}>لا سجلات حضور بعد.</EmptyRow>}
            {monthly.map((m) => (
              <tr key={m.key}>
                <td>{m.label}</td>
                <td className="ah-tabnum">{m.present}</td>
                <td className="ah-tabnum">{m.absent}</td>
                <td className="ah-tabnum">{m.late}</td>
                <td className="ah-tabnum">{m.excused}</td>
                <td className="ah-tabnum" style={{ fontWeight: 700 }}>{m.pct}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card ah-table-wrap" style={{ padding: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="event_available" size={18} color="var(--gold)" />
          <h2 className="card-title" style={{ margin: 0 }}>التفاصيل اليومية</h2>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>الصف / المادة</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 && <EmptyRow colSpan={3}>لا تفاصيل يومية.</EmptyRow>}
            {recent.map((r) => (
              <tr key={r.id || `${r.date}_${r.classId}`}>
                <td className="ah-tabnum">{r.date}</td>
                <td>
                  <div>{r.className || '—'}</div>
                  <div className="stu-class-meta">{r.subject || ''}</div>
                </td>
                <td><span className={`tag tag-${STATUS_TONE[r.status] || 'neutral'}`}>{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
