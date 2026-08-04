import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { orderBy, where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { ErrorBanner } from '../../components/ui';
import { useMyClasses } from '../../hooks/useMyClasses';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { enrolledDisplayCount, useEnrollmentCounts } from '../../hooks/useEnrollmentCounts';

const QUICK = [
  { to: '/teacher/schedule', icon: 'calendar_month', title: 'جدول الحصص', body: 'حصص اليوم والأسبوع.' },
  { to: '/teacher/attendance', icon: 'fact_check', title: 'الحضور والغياب', body: 'تسجيل حضور صفّك لليوم.' },
  { to: '/teacher/grades', icon: 'grade', title: 'الدرجات', body: 'امتحانات وفرض بانتظار الاعتماد.' },
  { to: '/teacher/diary', icon: 'edit_note', title: 'دفتر اليوم', body: 'موضوع الحصة والواجب والتنبيه.' },
  { to: '/teacher/attendance-report', icon: 'analytics', title: 'تقرير الحضور', body: 'من غاب كثيراً — للطباعة.' },
  { to: '/teacher/classes', icon: 'group', title: 'صفوفي وطلابي', body: 'كشف الأسماء وملف الطالب.' },
];

export default function TeacherDashboard() {
  const { myClasses, profile, error, demo } = useMyClasses();
  const classIds = useMemo(() => myClasses.map((c) => c.id), [myClasses]);
  const enrollmentCounts = useEnrollmentCounts(classIds);
  const { data: myGradeEntries } = useLiveOrDemo(
    'gradeEntries',
    [where('teacherId', '==', profile?.id || '__none__'), orderBy('createdAt', 'desc')],
    [],
    profile?.id,
  );
  const pendingGrades = useMemo(
    () => (myGradeEntries || []).filter((g) => g.status === 'قيد المراجعة'),
    [myGradeEntries],
  );
  const totalStudents = useMemo(
    () => myClasses.reduce((n, c) => {
      const count = enrolledDisplayCount(c, enrollmentCounts, { demo });
      return n + (count == null ? 0 : count);
    }, 0),
    [myClasses, enrollmentCounts, demo],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <ErrorBanner>{error && 'تعذّر تحميل صفوفك.'}</ErrorBanner>

      <div
        className="card"
        style={{
          borderColor: 'var(--color-accent-300)',
          background: 'var(--color-accent-100)',
          padding: '14px 16px',
          fontSize: 13,
          color: 'var(--color-accent-900)',
          lineHeight: 1.7,
        }}
      >
        لوحة إدارة صفوفك في المدرسة: الطلاب، الحضور، الدرجات، والملاحظات.
        {demo ? ' (وضع عرض — صِل Firebase للبيانات الحية.)' : ''}
      </div>

      <div className="ah-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
        <div className="card">
          <span className="card-kicker">صفوفي</span>
          <div className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 28, color: 'var(--gold)' }}>
            {myClasses.length}
          </div>
        </div>
        <div className="card">
          <span className="card-kicker">طلابي</span>
          <div className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 28 }}>
            {totalStudents}
          </div>
        </div>
        <div className="card">
          <span className="card-kicker">درجات بانتظار الاعتماد</span>
          <div className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 28 }}>
            {pendingGrades.length}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        {QUICK.map((q) => (
          <Link key={q.to} to={q.to} className="card" style={{ textDecoration: 'none', color: 'inherit', gap: 8 }}>
            <Icon name={q.icon} size={20} color="var(--gold)" />
            <div className="card-title" style={{ fontSize: 16 }}>{q.title}</div>
            <div className="card-body" style={{ fontSize: 13 }}>{q.body}</div>
          </Link>
        ))}
      </div>

      <section className="card" style={{ gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <h2 className="card-title" style={{ margin: 0 }}>صفوفي</h2>
          <Link to="/teacher/classes" className="btn btn-secondary" style={{ fontSize: 12, textDecoration: 'none' }}>
            كل الصفوف
          </Link>
        </div>

        {myClasses.length === 0 && (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-neutral-500)' }}>
            لا توجد صفوف مسندة إليك بعد. تواصل مع الإدارة لتعيينك معلّماً لصف.
          </p>
        )}

        <div style={{ display: 'grid', gap: 10 }}>
          {myClasses.map((c) => {
            const n = enrolledDisplayCount(c, enrollmentCounts, { demo });
            return (
            <div
              key={c.id}
              className="card"
              style={{
                padding: 14,
                background: 'color-mix(in srgb, #fff 70%, transparent)',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{c.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-neutral-600)', marginTop: 4 }}>
                    {[c.subject, c.grade, c.shift].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-neutral-600)', textAlign: 'left' }}>
                  {n == null ? '…' : `${n} طالب`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link to={`/teacher/classes/${c.id}`} className="btn btn-primary" style={{ fontSize: 12, textDecoration: 'none' }}>
                  فتح الصف
                </Link>
                <Link to={`/teacher/attendance?class=${c.id}`} className="btn btn-secondary" style={{ fontSize: 12, textDecoration: 'none' }}>
                  حضور
                </Link>
                <Link to={`/teacher/grades?class=${c.id}`} className="btn btn-secondary" style={{ fontSize: 12, textDecoration: 'none' }}>
                  درجات
                </Link>
                <Link to={`/teacher/observations?class=${c.id}`} className="btn btn-secondary" style={{ fontSize: 12, textDecoration: 'none' }}>
                  ملاحظات
                </Link>
              </div>
            </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
