import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { orderBy } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { EmptyRow, ErrorBanner } from '../../components/ui';
import { useMyClasses } from '../../hooks/useMyClasses';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { demoAttendanceSessions, demoEnrollments } from '../../data/demo';
import { monthLabelFromDate } from '../../lib/attendance';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function buildReport(enrolled, sessions, monthKey) {
  const monthSessions = (sessions || []).filter((s) => (s.date || s.id || '').startsWith(monthKey));
  const rows = (enrolled || []).map((s) => {
    const sid = s.studentId || s.id;
    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;
    let total = 0;
    for (const session of monthSessions) {
      const rec = session.records?.[sid];
      if (!rec) continue;
      total += 1;
      if (rec.status === 'حاضر') present += 1;
      else if (rec.status === 'غائب') absent += 1;
      else if (rec.status === 'متأخر') late += 1;
      else if (rec.status === 'مستأذن') excused += 1;
    }
    const pct = total ? Math.round(((present + late) / total) * 100) : null;
    return {
      studentId: sid,
      name: s.studentName || s.name,
      displayId: s.displayId || '—',
      present,
      absent,
      late,
      excused,
      total,
      pct,
      atRisk: absent >= 3 || (pct != null && pct < 75 && total >= 4),
    };
  });
  return rows.sort((a, b) => b.absent - a.absent || String(a.name).localeCompare(String(b.name), 'ar'));
}

export default function AttendanceReport() {
  const [params] = useSearchParams();
  const { myClasses, error, demo } = useMyClasses();
  const [classId, setClassId] = useState(params.get('class') || '');
  const activeClassId = classId || myClasses[0]?.id || '';
  const activeClass = myClasses.find((c) => c.id === activeClassId);
  const [month, setMonth] = useState(currentMonth());

  useEffect(() => {
    const fromUrl = params.get('class');
    if (fromUrl) setClassId(fromUrl);
  }, [params]);

  const { data: enrolled } = useLiveOrDemo(
    activeClassId ? `classes/${activeClassId}/enrollments` : '__none__',
    [orderBy('enrolledAt', 'asc')],
    demoEnrollments[activeClassId] || [],
    activeClassId,
  );

  const demoSessions = useMemo(() => {
    const raw = demoAttendanceSessions?.[activeClassId] || [];
    return raw.map((s, i) => ({ id: s.date || `d-${i}`, ...s }));
  }, [activeClassId]);

  const { data: sessions } = useLiveOrDemo(
    activeClassId ? `classes/${activeClassId}/attendanceSessions` : '__none__',
    [orderBy('date', 'desc')],
    demoSessions,
    activeClassId,
  );

  const rows = useMemo(() => buildReport(enrolled, sessions, month), [enrolled, sessions, month]);
  const atRiskCount = rows.filter((r) => r.atRisk).length;
  const monthLabel = monthLabelFromDate(`${month}-01`);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ErrorBanner>{error && 'تعذّر تحميل التقرير.'}</ErrorBanner>

      <div className="no-print" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
        <div className="field" style={{ minWidth: 200, flex: 1 }}>
          <label>الصف</label>
          <select className="input" value={activeClassId} onChange={(e) => setClassId(e.target.value)}>
            {myClasses.length === 0 && <option value="">لا صفوف</option>}
            {myClasses.map((c) => (
              <option key={c.id} value={c.id}>{c.title} — {c.subject}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ minWidth: 160 }}>
          <label>الشهر</label>
          <input className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} dir="ltr" />
        </div>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          <Icon name="print" size={15} /> طباعة / PDF
        </button>
        <Link to={`/teacher/attendance?class=${activeClassId}`} className="btn btn-secondary" style={{ textDecoration: 'none' }}>
          تسجيل حضور
        </Link>
      </div>

      <div className="card print-page" style={{ gap: 12, padding: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
          <div className="card-title" style={{ margin: 0 }}>
            تقرير حضور · {activeClass?.title || '—'} · {monthLabel}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-neutral-600)', marginTop: 6 }}>
            {[activeClass?.subject, activeClass?.grade].filter(Boolean).join(' · ')}
            {demo ? ' · عرض توضيحي' : ''}
            {atRiskCount > 0 ? ` · ${atRiskCount} يحتاج متابعة` : ''}
          </div>
        </div>
        <div className="ah-table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>الطالب</th>
                <th>الرقم</th>
                <th>حضور</th>
                <th>غياب</th>
                <th>تأخّر</th>
                <th>استئذان</th>
                <th>أيام</th>
                <th>النسبة</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <EmptyRow colSpan={8}>لا بيانات لهذا الشهر.</EmptyRow>}
              {rows.map((r) => (
                <tr key={r.studentId} style={r.atRisk ? { background: 'color-mix(in srgb, var(--color-accent-2-100) 55%, transparent)' } : undefined}>
                  <td>
                    {r.name}
                    {r.atRisk ? <span className="tag tag-neutral" style={{ marginInlineStart: 6, fontSize: 10 }}>متابعة</span> : null}
                  </td>
                  <td className="ah-tabnum">{r.displayId}</td>
                  <td className="ah-tabnum">{r.present}</td>
                  <td className="ah-tabnum" style={r.absent >= 3 ? { fontWeight: 700, color: 'var(--color-accent-2-700)' } : undefined}>{r.absent}</td>
                  <td className="ah-tabnum">{r.late}</td>
                  <td className="ah-tabnum">{r.excused}</td>
                  <td className="ah-tabnum">{r.total}</td>
                  <td className="ah-tabnum">{r.pct == null ? '—' : `${r.pct}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
