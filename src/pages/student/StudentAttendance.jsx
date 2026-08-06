import { useState } from 'react';
import { orderBy } from 'firebase/firestore';
import { ErrorBanner } from '../../components/ui';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { useMyStudent } from '../../hooks/useMyStudent';
import { computeAttendanceRate, computeMonthlyAttendance } from '../../lib/attendance';
import { demoAttendanceRecords } from '../../data/demo';

const STATUS_TONE = {
  حاضر: 'ok', غائب: 'bad', متأخر: 'warn', مستأذن: 'muted',
};

export default function StudentAttendance() {
  const { studentId, error: stuErr } = useMyStudent();
  const [showMonths, setShowMonths] = useState(false);

  const { data: records, error } = useLiveOrDemo(
    `students/${studentId || '__none__'}/attendanceRecords`,
    [orderBy('date', 'desc')],
    demoAttendanceRecords.s1 || [],
    studentId || '__none__',
  );

  const rate = computeAttendanceRate(records);
  const monthly = computeMonthlyAttendance(records);
  const recent = (records || []).slice(0, 30);
  const absent = (records || []).filter((r) => r.status === 'غائب').length;

  return (
    <div className="stu-page">
      <ErrorBanner>{(stuErr || error) && 'تعذّر تحميل الحضور.'}</ErrorBanner>

      <header className="stu-page-head">
        <h1 className="stu-page-title">حضوري</h1>
        <p className="stu-page-lead">من الأحدث إلى الأقدم</p>
      </header>

      <div className="stu-summary">
        <div className="stu-summary-item">
          <span className="stu-summary-val">{rate != null ? `${rate}%` : '—'}</span>
          <span className="stu-summary-lbl">نسبة الحضور</span>
        </div>
        <div className="stu-summary-item">
          <span className="stu-summary-val">{absent}</span>
          <span className="stu-summary-lbl">أيام غياب</span>
        </div>
      </div>

      {recent.length === 0 ? (
        <div className="stu-empty-block"><p>ما في سجل حضور بعد.</p></div>
      ) : (
        <div className="stu-list">
          {recent.map((r) => (
            <div key={r.id || `${r.date}_${r.classId}`} className="stu-list-row">
              <div className="stu-list-main">
                <div className="stu-list-title ah-tabnum">{r.date}</div>
                <div className="stu-list-sub">{[r.className, r.subject].filter(Boolean).join(' · ') || '—'}</div>
              </div>
              <span className={`stu-status stu-status--${STATUS_TONE[r.status] || 'muted'}`}>
                {r.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {monthly.length > 0 && (
        <div className="stu-collapse">
          <button type="button" className="stu-collapse-btn" onClick={() => setShowMonths((v) => !v)}>
            {showMonths ? 'إخفاء الملخص الشهري' : 'عرض الملخص الشهري'}
          </button>
          {showMonths && (
            <div className="stu-list" style={{ marginTop: 10 }}>
              {monthly.map((m) => (
                <div key={m.key} className="stu-list-row">
                  <div className="stu-list-main">
                    <div className="stu-list-title">{m.label}</div>
                    <div className="stu-list-sub">
                      حاضر {m.present} · غائب {m.absent} · متأخر {m.late}
                    </div>
                  </div>
                  <span className="stu-list-side ah-tabnum">{m.pct}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
