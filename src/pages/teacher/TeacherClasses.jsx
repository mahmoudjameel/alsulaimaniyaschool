import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import ClassScheduleLines from '../../components/ClassScheduleLines';
import { ErrorBanner } from '../../components/ui';
import { useMyClasses } from '../../hooks/useMyClasses';
import { enrolledDisplayCount, useEnrollmentCounts } from '../../hooks/useEnrollmentCounts';

export default function TeacherClasses() {
  const { myClasses, profile, error, demo } = useMyClasses();
  const classIds = useMemo(() => myClasses.map((c) => c.id), [myClasses]);
  const counts = useEnrollmentCounts(classIds);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ErrorBanner>{error && 'تعذّر تحميل الصفوف.'}</ErrorBanner>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)', lineHeight: 1.7 }}>
        الصفوف المسندة إليك مع أوقات حصصك. عند تسجيل المشرفة لطلاب يظهرون في كشف الصف فوراً.
        {demo ? ' (عرض توضيحي)' : ''}
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/teacher/students" className="btn btn-primary" style={{ textDecoration: 'none', fontSize: 13 }}>
          <Icon name="group" size={15} /> كل طلابي
        </Link>
        <Link to="/teacher/schedule" className="btn btn-secondary" style={{ textDecoration: 'none', fontSize: 13 }}>
          <Icon name="today" size={15} /> جدولي الأسبوعي
        </Link>
      </div>

      {myClasses.length === 0 && (
        <div className="card" style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>
          لا صفوف مسندة حالياً.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {myClasses.map((c) => {
          const n = enrolledDisplayCount(c, counts, { demo });
          return (
            <Link
              key={c.id}
              to={`/teacher/classes/${c.id}`}
              className="card"
              style={{ textDecoration: 'none', color: 'inherit', gap: 10 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="school" size={20} color="var(--gold)" />
                <div className="card-title" style={{ margin: 0, fontSize: 17 }}>{c.title}</div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-neutral-600)', lineHeight: 1.6 }}>
                {[c.grade, c.shift].filter(Boolean).join(' · ')}
              </div>
              <ClassScheduleLines cls={c} teacherId={profile?.id} empty="لم تُضبط حصصك على هذا الصف بعد" />
              <div style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>
                {n == null ? '…' : `${n} طالب مسجّل`}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
