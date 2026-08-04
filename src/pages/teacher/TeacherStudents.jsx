import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import SearchInput from '../../components/SearchInput';
import { EmptyRow, ErrorBanner } from '../../components/ui';
import { useMyStudents } from '../../hooks/useMyStudents';
import { filterByStudentSearch } from '../../lib/studentSearch';

export default function TeacherStudents() {
  const { students, myClasses, error, demo } = useMyStudents();
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');

  const filtered = useMemo(() => {
    let list = students;
    if (classFilter) {
      list = list.filter((s) => s.classes.some((c) => c.id === classFilter));
    }
    return filterByStudentSearch(list, search, ['name', 'displayId', 'grade']);
  }, [students, search, classFilter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ErrorBanner>{error && 'تعذّر تحميل الطلاب.'}</ErrorBanner>

      <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)', lineHeight: 1.7 }}>
        كل طلاب صفوفك في قائمة واحدة. اضغط على الطالب لفتح ملفّه الكامل: حضور، درجات، ملاحظات، واتساب، ومتابعة.
        {demo ? ' (عرض توضيحي)' : ''}
      </p>

      <div className="card" style={{ gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <SearchInput value={search} onChange={setSearch} placeholder="بحث بالاسم أو الرقم الدراسي…" />
          </div>
          <div className="field" style={{ minWidth: 200 }}>
            <label>تصفية حسب الصف</label>
            <select className="input" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
              <option value="">كل صفوفي ({myClasses.length})</option>
              {myClasses.map((c) => (
                <option key={c.id} value={c.id}>{c.title} — {c.subject}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-neutral-600)' }}>
          {filtered.length} طالب{search || classFilter ? ' مطابق' : ''}
          {' · '}
          {students.length} إجمالي في صفوفك
        </div>
      </div>

      {myClasses.length === 0 && (
        <div className="card" style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>
          لا صفوف مسندة — عيّن الإدارة صفّاً بحسابك أولاً.
        </div>
      )}

      <div className="card ah-table-wrap" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>الطالب</th>
              <th>الرقم</th>
              <th>المرحلة</th>
              <th>صفوفي معه</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <EmptyRow colSpan={5}>
                {students.length === 0 ? 'لا طلاب مسجّلين في صفوفك بعد.' : 'لا نتائج مطابقة للبحث.'}
              </EmptyRow>
            )}
            {filtered.map((s) => (
              <tr key={s.studentId}>
                <td style={{ fontWeight: 600 }}>{s.name}</td>
                <td className="ah-tabnum">{s.displayId || '—'}</td>
                <td>{s.grade || '—'}</td>
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {s.classes.map((c) => (
                      <span key={c.id} className="tag tag-outline" style={{ fontSize: 11 }}>
                        {c.title}
                      </span>
                    ))}
                  </div>
                </td>
                <td style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>
                  <Link
                    to={`/teacher/students/${s.studentId}`}
                    className="btn btn-primary"
                    style={{ fontSize: 12, textDecoration: 'none' }}
                  >
                    <Icon name="person" size={14} /> ملف الطالب
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
