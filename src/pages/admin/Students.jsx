import { useMemo, useRef, useState } from 'react';
import { orderBy } from 'firebase/firestore';
import { useLocation, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import SearchInput from '../../components/SearchInput';
import { EmptyRow, ErrorBanner } from '../../components/ui';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { demoStudents } from '../../data/demo';
import { formatILS } from '../../lib/constants';
import { useAcademicStages } from '../../hooks/useAcademicStages';
import { bulkCreateStudents, parseStudentsCsv } from '../../services/students';
import NewStudentModal from '../../modals/NewStudentModal';
import { studentProfilePath } from '../../lib/portalPaths';
import { matchesStudentSearch } from '../../lib/studentSearch';

export default function Students() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { labels: stageLabels } = useAcademicStages();
  const { data, loading, error, demo } = useLiveOrDemo('students', [orderBy('createdAt', 'desc')], demoStudents);
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('الكل');
  const [statusFilter, setStatusFilter] = useState('الكل');
  const [shiftFilter, setShiftFilter] = useState('الكل');
  const [showNewStudent, setShowNewStudent] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  const filtered = useMemo(() => data.filter((s) => (
    matchesStudentSearch(s, search)
    && (gradeFilter === 'الكل' || (s.grade || '').startsWith(gradeFilter))
    && (statusFilter === 'الكل' || s.status === statusFilter)
    && (shiftFilter === 'الكل' || s.shift === shiftFilter)
  )), [data, search, gradeFilter, statusFilter, shiftFilter]);

  const onImportClick = () => fileRef.current?.click();
  const onFileChosen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseStudentsCsv(text);
      if (rows.length && !demo) await bulkCreateStudents(rows);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ErrorBanner>{error && 'تعذّر تحميل قائمة الطلاب.'}</ErrorBanner>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="بحث: اسم الطالب أو رقم الهوية أو الرقم الدراسي…"
          style={{ flex: '1 1 260px', maxWidth: 480 }}
        />
        <select className="input" style={{ width: 'auto', fontSize: 13 }} value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}>
          <option value="الكل">الصف: الكل</option>
          {stageLabels.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select className="input" style={{ width: 'auto', fontSize: 13 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="الكل">الحالة: الكل</option>
          <option value="نشط">نشط</option>
          <option value="متخرّج">متخرّج</option>
        </select>
        <select className="input" style={{ width: 'auto', fontSize: 13 }} value={shiftFilter} onChange={(e) => setShiftFilter(e.target.value)}>
          <option value="الكل">الفترة: الكل</option>
          <option value="صباحي">صباحي</option>
          <option value="مسائي">مسائي</option>
        </select>
        <span style={{ marginInlineStart: 'auto', fontSize: 13, color: 'var(--color-neutral-500)' }}>{filtered.length} طالباً</span>
        <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={onFileChosen} />
        <button className="btn btn-secondary" style={{ fontSize: 13 }} onClick={onImportClick} disabled={importing}>
          <Icon name="upload_file" size={15} /> {importing ? 'جارٍ الاستيراد…' : 'استيراد CSV'}
        </button>
        <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => setShowNewStudent(true)}>
          <Icon name="add" size={15} /> طالب جديد
        </button>
      </div>
      <div className="card ah-table-wrap" style={{ padding: 0 }}>
        <table className="table">
          <thead><tr><th>الطالب</th><th>الصف</th><th>الفترة</th><th>الحالة</th><th>الرصيد المستحق</th><th>ولي الأمر</th><th></th></tr></thead>
          <tbody>
            {!loading && filtered.length === 0 && <EmptyRow colSpan={7}>لا يوجد طلاب مطابقون لهذا التصفية.</EmptyRow>}
            {filtered.map((s) => (
              <tr key={s.id} onClick={() => navigate(studentProfilePath(pathname, s.id))} style={{ cursor: 'pointer' }}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--color-accent-100)', color: 'var(--color-accent-800)', display: 'grid', placeItems: 'center', fontSize: 12 }}>{s.initial}</div>
                    <div>
                      <div>{s.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-neutral-500)' }} className="ah-tabnum">
                        {s.displayId}
                        {s.nationalId ? ` · هوية ${s.nationalId}` : ''}
                      </div>
                    </div>
                  </div>
                </td>
                <td>{s.grade}</td>
                <td>{s.shift}</td>
                <td><span className={`tag ${s.status === 'نشط' ? 'tag-accent' : 'tag-neutral'}`}>{s.status}</span></td>
                <td className="ah-tabnum" style={{ color: s.balanceMinorUnits > 0 ? 'var(--gold)' : 'var(--color-neutral-500)' }}>{s.balanceMinorUnits > 0 ? formatILS(s.balanceMinorUnits) : '—'}</td>
                <td>{s.guardianName}</td>
                <td style={{ textAlign: 'left' }}><Icon name="chevron_left" size={16} color="var(--color-neutral-400)" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showNewStudent && <NewStudentModal demo={demo} onClose={() => setShowNewStudent(false)} />}
    </div>
  );
}
