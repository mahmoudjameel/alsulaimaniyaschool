import { useMemo, useState } from 'react';
import { orderBy } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import SearchInput from '../../components/SearchInput';
import { ErrorBanner } from '../../components/ui';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { demoClasses, demoTeacherProfiles } from '../../data/demo';
import NewTeacherModal from '../../modals/NewTeacherModal';
import { matchesTeacherSearch } from '../../lib/studentSearch';

function weeklyMinutes(schedule) {
  return (schedule || []).reduce((sum, s) => {
    const [sh, sm] = (s.start || '0:0').split(':').map(Number);
    const [eh, em] = (s.end || '0:0').split(':').map(Number);
    return sum + Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
  }, 0);
}

export default function Teachers() {
  const navigate = useNavigate();
  const { data: teachers, error, demo } = useLiveOrDemo('teacherProfiles', [orderBy('name', 'asc')], demoTeacherProfiles);
  const { data: classes } = useLiveOrDemo('classes', [orderBy('createdAt', 'desc')], demoClasses);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [shiftFilter, setShiftFilter] = useState('الكل');

  const rows = useMemo(() => teachers.map((t) => {
    const theirClasses = classes.filter((c) => c.teacherId === t.id);
    const totalStudents = theirClasses.reduce((sum, c) => sum + Number(c.students ?? c.studentsCount ?? 0), 0);
    const totalMinutes = theirClasses.reduce((sum, c) => sum + weeklyMinutes(c.schedule), 0);
    const shifts = [...new Set(theirClasses.map((c) => c.shift).filter(Boolean))];
    return { ...t, classesCount: theirClasses.length, totalStudents, weeklyHours: Math.round(totalMinutes / 60 * 10) / 10, shifts };
  }), [teachers, classes]);

  const filteredRows = useMemo(
    () => rows.filter((t) => matchesTeacherSearch(t, search) && (shiftFilter === 'الكل' || t.shifts.includes(shiftFilter))),
    [rows, search, shiftFilter]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ErrorBanner>{error && 'تعذّر تحميل دليل المعلّمين.'}</ErrorBanner>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h4 style={{ margin: 0 }}>دليل المعلّمين</h4>
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
        <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => setShowModal(true)}>
          <Icon name="person_add" size={14} /> إضافة معلّم
        </button>
      </div>
      <div className="card ah-table-wrap" style={{ padding: 0 }}>
        <table className="table">
          <thead><tr><th>المعلّم</th><th>التخصّص</th><th>عدد الصفوف</th><th>إجمالي الطلاب</th><th>ساعات أسبوعية</th><th>الدوام</th><th></th></tr></thead>
          <tbody>
            {filteredRows.map((t) => (
              <tr key={t.id} onClick={() => navigate(`/admin/teachers/${t.id}`)} style={{ cursor: 'pointer' }}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--color-accent-100)', color: 'var(--color-accent-800)', display: 'grid', placeItems: 'center', fontSize: 12 }}>{t.initial}</div>
                    {t.name}
                  </div>
                </td>
                <td>{t.subject}</td>
                <td className="ah-tabnum">{t.classesCount}</td>
                <td className="ah-tabnum">{t.totalStudents}</td>
                <td className="ah-tabnum">{t.weeklyHours || '—'}</td>
                <td>{t.shifts.length ? t.shifts.map((s) => <span key={s} className="tag tag-neutral" style={{ marginInlineEnd: 4 }}>{s}</span>) : '—'}</td>
                <td style={{ textAlign: 'left' }}><Icon name="chevron_left" size={16} color="var(--color-neutral-400)" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showModal && <NewTeacherModal demo={demo} onClose={() => setShowModal(false)} />}
    </div>
  );
}
