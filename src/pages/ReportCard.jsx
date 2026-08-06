import { useMemo } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { orderBy, where } from 'firebase/firestore';
import Icon from '../components/Icon';
import Logo from '../components/Logo';
import BackButton from '../components/BackButton';
import { ErrorBanner } from '../components/ui';
import { useDocOrDemo, useLiveOrDemo } from '../hooks/useFirestore';
import { demoStudents, demoGradeEntries, demoAttendanceRecords } from '../data/demo';
import { useAcademicYearLabel } from '../components/AcademicYearText';
import { computeAttendanceRate } from '../lib/attendance';
import { scoreToBand } from '../services/grades';

import { studentProfilePath } from '../lib/portalPaths';

export default function ReportCard() {
  const { id } = useParams();
  const { pathname } = useLocation();
  const { academicYear } = useAcademicYearLabel();

  const { data: student, error } = useDocOrDemo(`students/${id}`, demoStudents.find((s) => s.id === id) || null);
  const { data: grades } = useLiveOrDemo(
    'gradeEntries',
    [where('studentId', '==', id), where('status', '==', 'معتمد')],
    demoGradeEntries.filter((g) => g.studentId === id && g.status === 'معتمد')
  );
  const { data: attendance } = useLiveOrDemo(
    `students/${id}/attendanceRecords`,
    [orderBy('date', 'asc')],
    demoAttendanceRecords[id] || []
  );

  const bySubject = useMemo(() => {
    const groups = new Map();
    for (const g of grades) {
      if (!groups.has(g.subject)) groups.set(g.subject, { subject: g.subject, className: g.className, teacherName: g.teacherName, entries: [] });
      groups.get(g.subject).entries.push(g);
    }
    return [...groups.values()].map((s) => {
      const totalScore = s.entries.reduce((sum, e) => sum + (Number(e.score) / Number(e.maxScore)) * 100, 0);
      const avgPct = s.entries.length ? Math.round(totalScore / s.entries.length) : 0;
      return { ...s, avgPct, band: scoreToBand(avgPct, 100) };
    });
  }, [grades]);

  const overallAvgPct = bySubject.length ? Math.round(bySubject.reduce((sum, s) => sum + s.avgPct, 0) / bySubject.length) : null;
  const attendanceRate = computeAttendanceRate(attendance);

  if (!student) return <ErrorBanner>{error ? 'تعذّر تحميل بيانات الطالب.' : 'لا توجد بيانات لهذا الطالب.'}</ErrorBanner>;

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '32px 24px' }} className="print-page">
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <BackButton
          to={
            pathname.startsWith('/parent') ? '/parent'
              : pathname.startsWith('/student') ? '/student/grades'
                : studentProfilePath(pathname, id)
          }
          label={
            pathname.startsWith('/parent') ? 'عودة لبوابة ولي الأمر'
              : pathname.startsWith('/student') ? 'عودة لدرجاتي'
                : 'رجوع لملف الطالب'
          }
        />
        <button type="button" className="btn btn-primary" onClick={() => window.print()}><Icon name="print" size={15} /> طباعة / حفظ PDF</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--gold)', paddingBottom: 16, marginBottom: 20 }}>
        <Logo size={48} full />
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18 }}>كشف العلامات</div>
          <div style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>العام الدراسي {academicYear}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24, fontSize: 13 }}>
        <Info label="اسم الطالب" value={student.name} />
        <Info label="الرقم الدراسي" value={student.displayId} />
        <Info label="الصف" value={student.grade} />
        <Info label="تاريخ الإصدار" value={new Date().toLocaleDateString('ar-EG')} />
      </div>

      <table className="table" style={{ marginBottom: 20 }}>
        <thead><tr><th>المادة</th><th>المعلّم</th><th>عدد التقييمات</th><th>المعدّل</th><th>التقدير</th></tr></thead>
        <tbody>
          {bySubject.length === 0 && (
            <tr><td colSpan={5} style={{ textAlign: 'center', padding: '20px 12px', color: 'var(--color-neutral-500)' }}>لا توجد درجات معتمدة بعد لإصدار كشف كامل.</td></tr>
          )}
          {bySubject.map((s) => (
            <tr key={s.subject}>
              <td>{s.subject}</td>
              <td>{s.teacherName}</td>
              <td className="ah-tabnum">{s.entries.length}</td>
              <td className="ah-tabnum">{s.avgPct}%</td>
              <td><span className="tag tag-accent">{s.band}</span></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
        <div className="card">
          <span className="card-kicker">المعدّل العام</span>
          <div className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 28, color: 'var(--gold)' }}>{overallAvgPct != null ? `${overallAvgPct}%` : '—'}</div>
        </div>
        <div className="card">
          <span className="card-kicker">نسبة الحضور</span>
          <div className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 28, color: 'var(--gold)' }}>{attendanceRate != null ? `${attendanceRate}%` : '—'}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 60, fontSize: 13 }}>
        <div style={{ textAlign: 'center' }}>توقيع مدير المدرسة<div style={{ marginTop: 32, borderTop: '1px solid var(--line)', paddingTop: 6, width: 160 }}>&nbsp;</div></div>
        <div style={{ textAlign: 'center' }}>توقيع ولي الأمر<div style={{ marginTop: 32, borderTop: '1px solid var(--line)', paddingTop: 6, width: 160 }}>&nbsp;</div></div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div style={{ color: 'var(--color-neutral-500)', fontSize: 11 }}>{label}</div>
      <div>{value || '—'}</div>
    </div>
  );
}
