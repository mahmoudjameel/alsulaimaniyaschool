import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { orderBy } from 'firebase/firestore';
import Icon from '../../components/Icon';
import BackButton from '../../components/BackButton';
import { ErrorBanner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useDocOrDemo, useLiveOrDemo } from '../../hooks/useFirestore';
import { demoClasses, demoTeacherProfiles } from '../../data/demo';
import { classHasTeacher, scheduleForTeacher } from '../../lib/classForm';
import EditTeacherModal from '../../modals/EditTeacherModal';
import { deleteTeacherProfile } from '../../services/teachers';
import { logActivity } from '../../services/activity';

export default function TeacherDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: teacher, error, demo } = useDocOrDemo(`teacherProfiles/${id}`, demoTeacherProfiles.find((t) => t.id === id) || demoTeacherProfiles[0]);
  const { data: classes } = useLiveOrDemo('classes', [orderBy('createdAt', 'desc')], demoClasses);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const theirClasses = useMemo(() => classes.filter((c) => classHasTeacher(c, id)), [classes, id]);
  const totalStudents = theirClasses.reduce((sum, c) => sum + Number(c.studentsCount ?? c.students ?? 0), 0);

  if (!teacher) return <ErrorBanner>تعذّر العثور على هذا المعلّم.</ErrorBanner>;

  const onDelete = async () => {
    if (demo) return;
    const linked = theirClasses.length > 0
      ? `\nتنبيه: مرتبط بـ ${theirClasses.length} صف.`
      : '';
    if (!window.confirm(`حذف المعلّم «${teacher.name}» من الدليل؟${linked}`)) return;
    setBusy(true);
    try {
      await deleteTeacherProfile(id);
      await logActivity({
        type: 'teacher_deleted',
        actorUid: profile?.id,
        actorName: profile?.name,
        actorRole: profile?.role,
        summary: `حذف معلّم من الدليل: ${teacher.name}`,
        targetType: 'teacherProfile',
        targetId: id,
      });
      navigate('/admin/teachers');
    } catch {
      window.alert('تعذّر حذف المعلّم.');
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <ErrorBanner>{error && 'تعذّر تحميل بيانات المعلّم.'}</ErrorBanner>
      <BackButton to="/admin/teachers" label="عودة لدليل المعلّمين" />

      <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--color-accent-100)', color: 'var(--color-accent-800)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-heading)', fontSize: 28 }}>{teacher.initial}</div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h2 style={{ margin: 0 }}>{teacher.name}</h2>
          <div style={{ color: 'var(--gold)', fontSize: 14 }}>{teacher.subject}</div>
          {teacher.bio && <div style={{ fontSize: 13, color: 'var(--color-neutral-600)', marginTop: 4 }}>{teacher.bio}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" style={{ fontSize: 13 }} disabled={demo} onClick={() => setEditing(true)}>
            <Icon name="edit" size={14} /> تعديل
          </button>
          <button type="button" className="btn btn-secondary" style={{ fontSize: 13, color: 'var(--color-accent-2-700)' }} disabled={demo || busy} onClick={onDelete}>
            حذف من الدليل
          </button>
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
            <div className="card-meta">{c.grade} · {c.studentsCount ?? c.students ?? 0} طالباً</div>
            {(scheduleForTeacher(c, id) || []).map((s, i) => (
              <div key={i} style={{ fontSize: 11, color: 'var(--color-neutral-500)' }} dir="ltr">
                {s.day} · {s.start}–{s.end}{s.subject ? ` · ${s.subject}` : ''}
              </div>
            ))}
          </button>
        ))}
      </div>

      {editing && (
        <EditTeacherModal
          teacher={teacher}
          demo={demo}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
