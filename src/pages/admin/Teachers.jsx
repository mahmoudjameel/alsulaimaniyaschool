import { useMemo, useState } from 'react';
import { orderBy } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import SearchInput from '../../components/SearchInput';
import { ErrorBanner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { demoClasses, demoTeacherProfiles } from '../../data/demo';
import NewTeacherModal from '../../modals/NewTeacherModal';
import EditTeacherModal from '../../modals/EditTeacherModal';
import { matchesTeacherSearch } from '../../lib/studentSearch';
import { classHasTeacher, scheduleForTeacher } from '../../lib/classForm';
import { deleteTeacherProfile } from '../../services/teachers';
import { logActivity } from '../../services/activity';

function weeklyMinutes(schedule) {
  return (schedule || []).reduce((sum, s) => {
    const [sh, sm] = (s.start || '0:0').split(':').map(Number);
    const [eh, em] = (s.end || '0:0').split(':').map(Number);
    return sum + Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
  }, 0);
}

export default function Teachers() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: teachers, error, demo } = useLiveOrDemo('teacherProfiles', [orderBy('name', 'asc')], demoTeacherProfiles);
  const { data: classes } = useLiveOrDemo('classes', [orderBy('createdAt', 'desc')], demoClasses);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [search, setSearch] = useState('');
  const [shiftFilter, setShiftFilter] = useState('الكل');

  const rows = useMemo(() => teachers.map((t) => {
    const theirClasses = classes.filter((c) => classHasTeacher(c, t.id));
    const totalStudents = theirClasses.reduce((sum, c) => sum + Number(c.studentsCount ?? c.students ?? 0), 0);
    const totalMinutes = theirClasses.reduce((sum, c) => sum + weeklyMinutes(scheduleForTeacher(c, t.id)), 0);
    const shifts = [...new Set(theirClasses.map((c) => c.shift).filter(Boolean))];
    return { ...t, classesCount: theirClasses.length, totalStudents, weeklyHours: Math.round(totalMinutes / 60 * 10) / 10, shifts };
  }), [teachers, classes]);

  const filteredRows = useMemo(
    () => rows.filter((t) => matchesTeacherSearch(t, search) && (shiftFilter === 'الكل' || t.shifts.includes(shiftFilter))),
    [rows, search, shiftFilter],
  );

  const onDelete = async (t) => {
    if (demo) return;
    const linked = t.classesCount > 0
      ? `\nتنبيه: مرتبط بـ ${t.classesCount} صف — احذف بحذر.`
      : '';
    if (!window.confirm(`حذف المعلّم «${t.name}» من الدليل؟${linked}`)) return;
    setBusyId(t.id);
    try {
      await deleteTeacherProfile(t.id);
      await logActivity({
        type: 'teacher_deleted',
        actorUid: profile?.id,
        actorName: profile?.name,
        actorRole: profile?.role,
        summary: `حذف معلّم من الدليل: ${t.name}`,
        targetType: 'teacherProfile',
        targetId: t.id,
      });
    } catch {
      window.alert('تعذّر حذف المعلّم.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ErrorBanner>{error && 'تعذّر تحميل دليل المعلّمين.'}</ErrorBanner>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h4 style={{ margin: 0 }}>دليل المعلّمين</h4>
        <Link to="/admin/subjects" className="ah-tablink" style={{ fontSize: 13, color: 'var(--gold)' }}>مواد التدريس ←</Link>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="بحث باسم المعلّم أو التخصّص…"
          style={{ marginInlineStart: 'auto', maxWidth: 320 }}
        />
        <select className="input" style={{ width: 'auto', fontSize: 13 }} value={shiftFilter} onChange={(e) => setShiftFilter(e.target.value)}>
          <option value="الكل">الدوام: الكل</option>
          <option value="صباحي">صباحي</option>
          <option value="مسائي">مسائي</option>
        </select>
        <button type="button" className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => setShowModal(true)}>
          <Icon name="person_add" size={14} /> إضافة معلّم
        </button>
      </div>
      <div className="card ah-table-wrap" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>المعلّم</th>
              <th>التخصّص</th>
              <th>البريد / الدخول</th>
              <th>عدد الصفوف</th>
              <th>إجمالي الطلاب</th>
              <th>ساعات أسبوعية</th>
              <th>الدوام</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((t) => (
              <tr key={t.id}>
                <td>
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/teachers/${t.id}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, background: 'transparent',
                      border: 0, padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit', textAlign: 'right',
                    }}
                  >
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--color-accent-100)', color: 'var(--color-accent-800)', display: 'grid', placeItems: 'center', fontSize: 12 }}>{t.initial}</div>
                    {t.name}
                  </button>
                </td>
                <td>{t.subject}</td>
                <td>
                  {t.email ? (
                    <span dir="ltr" style={{ fontSize: 12 }}>{t.email}</span>
                  ) : (
                    <span className="tag tag-outline" style={{ fontSize: 11 }}>غير مربوط</span>
                  )}
                </td>
                <td className="ah-tabnum">{t.classesCount}</td>
                <td className="ah-tabnum">{t.totalStudents}</td>
                <td className="ah-tabnum">{t.weeklyHours || '—'}</td>
                <td>{t.shifts.length ? t.shifts.map((s) => <span key={s} className="tag tag-neutral" style={{ marginInlineEnd: 4 }}>{s}</span>) : '—'}</td>
                <td style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: 12 }}
                    disabled={demo}
                    onClick={() => setEditing(t)}
                  >
                    تعديل
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: 12, color: 'var(--color-accent-2-700)' }}
                    disabled={demo || busyId === t.id}
                    onClick={() => onDelete(t)}
                  >
                    حذف
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showModal && <NewTeacherModal demo={demo} onClose={() => setShowModal(false)} />}
      {editing && <EditTeacherModal teacher={editing} demo={demo} onClose={() => setEditing(null)} />}
    </div>
  );
}
