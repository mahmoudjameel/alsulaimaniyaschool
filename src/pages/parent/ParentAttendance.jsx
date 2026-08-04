import { useEffect, useState } from 'react';
import { orderBy } from 'firebase/firestore';
import ChildSwitcher from '../../components/ChildSwitcher';
import Icon from '../../components/Icon';
import { EmptyRow, ErrorBanner } from '../../components/ui';
import { useMyChildren } from '../../hooks/useMyChildren';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { computeAttendanceRate, computeMonthlyAttendance } from '../../lib/attendance';
import { demoAttendanceRecords } from '../../data/demo';

const STATUS_TONE = {
  حاضر: 'accent', غائب: 'accent2', متأخر: 'outline', مستأذن: 'neutral',
};

export default function ParentAttendance() {
  const { children, error: childErr } = useMyChildren();
  const [selectedId, setSelectedId] = useState(children[0]?.id || '');

  useEffect(() => {
    if (children.length && !children.some((c) => c.id === selectedId)) {
      setSelectedId(children[0].id);
    }
  }, [children, selectedId]);

  const activeId = selectedId || children[0]?.id;
  const active = children.find((c) => c.id === activeId) || children[0];

  const { data: records, error } = useLiveOrDemo(
    `students/${activeId || '__none__'}/attendanceRecords`,
    [orderBy('date', 'desc')],
    demoAttendanceRecords[activeId] || demoAttendanceRecords.s1 || [],
    activeId || '__none__',
  );

  const monthly = computeMonthlyAttendance(records);
  const rate = computeAttendanceRate(records);
  const recent = (records || []).slice(0, 40);

  return (
    <div className="stu-page">
      <ErrorBanner>{(childErr || error) && 'تعذّر تحميل سجل الحضور.'}</ErrorBanner>
      <header className="stu-page-head">
        <h1 className="stu-page-title">الحضور والغياب</h1>
        <p className="stu-page-lead">مواظبة الأبناء كما يسجّلها المعلّم.</p>
      </header>

      <ChildSwitcher children={children} selectedId={activeId} onChange={setSelectedId} />

      {!active && (
        <div className="card stu-empty-card">
          <Icon name="event_available" size={28} color="var(--gold)" />
          <p>لا أبناء مرتبطون.</p>
        </div>
      )}

      {active && (
        <>
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
              <h2 className="card-title" style={{ margin: 0 }}>ملخص شهري — {active.name}</h2>
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
                    <td className="ah-tabnum">{m.pct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="card ah-table-wrap" style={{ padding: 0 }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
              <h2 className="card-title" style={{ margin: 0 }}>آخر السجلات</h2>
            </div>
            <table className="table">
              <thead>
                <tr><th>التاريخ</th><th>الصف</th><th>الحالة</th></tr>
              </thead>
              <tbody>
                {recent.length === 0 && <EmptyRow colSpan={3}>لا سجلات.</EmptyRow>}
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td className="ah-tabnum">{r.date}</td>
                    <td>{r.className || r.subject || '—'}</td>
                    <td><span className={`tag tag-${STATUS_TONE[r.status] || 'neutral'}`}>{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
