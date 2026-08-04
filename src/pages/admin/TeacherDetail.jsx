import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { orderBy } from 'firebase/firestore';
import Icon from '../../components/Icon';
import BackButton from '../../components/BackButton';
import { ErrorBanner } from '../../components/ui';
import { useDocOrDemo, useLiveOrDemo } from '../../hooks/useFirestore';
import { demoClasses, demoTeacherProfiles } from '../../data/demo';

export default function TeacherDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: teacher, error } = useDocOrDemo(`teacherProfiles/${id}`, demoTeacherProfiles.find((t) => t.id === id) || demoTeacherProfiles[0]);
  const { data: classes } = useLiveOrDemo('classes', [orderBy('createdAt', 'desc')], demoClasses);

  const theirClasses = useMemo(() => classes.filter((c) => c.teacherId === id), [classes, id]);
  const totalStudents = theirClasses.reduce((sum, c) => sum + Number(c.students ?? c.studentsCount ?? 0), 0);

  if (!teacher) return <ErrorBanner>تعذّر العثور على هذا المعلّم.</ErrorBanner>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <ErrorBanner>{error && 'تعذّر تحميل بيانات المعلّم.'}</ErrorBanner>
      <BackButton to="/admin/teachers" label="عودة لدليل المعلّمين" />

      <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--color-accent-100)', color: 'var(--color-accent-800)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-heading)', fontSize: 28 }}>{teacher.initial}</div>
        <div>
          <h2 style={{ margin: 0 }}>{teacher.name}</h2>
          <div style={{ color: 'var(--gold)', fontSize: 14 }}>{teacher.subject}</div>
          {teacher.bio && <div style={{ fontSize: 13, color: 'var(--color-neutral-600)', marginTop: 4 }}>{teacher.bio}</div>}
        </div>
      </div>

      <div className="ah-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        <div className="card"><span className="card-kicker">عدد الصفوف</span><div className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 28, color: 'var(--gold)' }}>{theirClasses.length}</div></div>
        <div className="card"><span className="card-kicker">إجمالي الطلاب</span><div className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 28, color: 'var(--gold)' }}>{totalStudents}</div></div>
        <div className="card"><span className="card-kicker">التواصل</span><div style={{ fontSize: 13, marginTop: 6 }} dir="ltr">{teacher.email || '—'}<br />{teacher.phone || ''}</div></div>
      </div>

      <div className="card-title">صفوفه</div>
      <div className="ah-3col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        {theirClasses.length === 0 && <div style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>لا يدرّس أي صفّ حالياً.</div>}
        {theirClasses.map((c) => (
          <button key={c.id} className="card" onClick={() => navigate(`/admin/classes/${c.id}`)} style={{ textAlign: 'right', cursor: 'pointer', background: 'transparent' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span className="tag tag-outline">{c.subject}</span>
              {c.shift && <span className="tag tag-neutral">{c.shift}</span>}
            </div>
            <div className="card-title" style={{ fontSize: 15 }}>{c.title}</div>
            <div className="card-meta">{c.grade} · {c.students ?? c.studentsCount ?? 0} طالباً</div>
            {(c.schedule || []).map((s, i) => (
              <div key={i} style={{ fontSize: 11, color: 'var(--color-neutral-500)' }} dir="ltr">{s.day} · {s.start}–{s.end}</div>
            ))}
          </button>
        ))}
      </div>
    </div>
  );
}
