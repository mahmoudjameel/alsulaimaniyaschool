import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import { ErrorBanner } from '../../components/ui';
import { useMyClasses } from '../../hooks/useMyClasses';

export default function TeacherClasses() {
  const { myClasses, error, demo } = useMyClasses();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ErrorBanner>{error && 'تعذّر تحميل الصفوف.'}</ErrorBanner>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)', lineHeight: 1.7 }}>
        الصفوف المسندة إليك من الإدارة. افتح الصف لعرض كشف الطلاب والعمل على الحضور والدرجات.
        {demo ? ' (عرض توضيحي)' : ''}
      </p>

      {myClasses.length === 0 && (
        <div className="card" style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>
          لا صفوف مسندة حالياً.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {myClasses.map((c) => (
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
              {[c.subject, c.grade, c.shift].filter(Boolean).join(' · ')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>
              {Number(c.studentsCount ?? c.students ?? 0)} طالب مسجّل
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
