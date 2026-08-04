import { useMemo, useState } from 'react';
import { orderBy } from 'firebase/firestore';
import SearchInput from '../../components/SearchInput';
import { SegmentedTabs, EmptyRow, ErrorBanner } from '../../components/ui';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { useAuth } from '../../context/AuthContext';
import { demoGradeEntries } from '../../data/demo';
import { approveGrade, rejectGrade } from '../../services/grades';
import { matchesStudentSearch } from '../../lib/studentSearch';

const TABS = [
  { id: 'قيد المراجعة', label: 'قيد المراجعة' },
  { id: 'معتمد', label: 'معتمدة' },
  { id: 'مرفوض', label: 'مرفوضة' },
];

export default function Grades() {
  const { profile } = useAuth();
  const [filter, setFilter] = useState('قيد المراجعة');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [localOverrides, setLocalOverrides] = useState({});
  const { data, error, demo } = useLiveOrDemo('gradeEntries', [orderBy('createdAt', 'desc')], demoGradeEntries);

  const rows = useMemo(() => data.map((g) => (localOverrides[g.id] ? { ...g, status: localOverrides[g.id] } : g)), [data, localOverrides]);
  const counts = useMemo(() => ({
    'قيد المراجعة': rows.filter((g) => g.status === 'قيد المراجعة').length,
    'معتمد': rows.filter((g) => g.status === 'معتمد').length,
    'مرفوض': rows.filter((g) => g.status === 'مرفوض').length,
  }), [rows]);
  const view = useMemo(
    () => rows.filter((g) => g.status === filter && matchesStudentSearch(g, search, ['assessmentTitle', 'teacherName', 'className', 'subject'])),
    [rows, filter, search],
  );

  const decidedBy = { uid: profile?.id, name: profile?.name, role: profile?.role };

  const onApprove = async (entry) => {
    setBusyId(entry.id);
    try {
      if (demo) setLocalOverrides((s) => ({ ...s, [entry.id]: 'معتمد' }));
      else await approveGrade(entry, decidedBy);
    } finally {
      setBusyId(null);
    }
  };
  const onReject = async (entry) => {
    setBusyId(entry.id);
    try {
      if (demo) setLocalOverrides((s) => ({ ...s, [entry.id]: 'مرفوض' }));
      else await rejectGrade(entry, decidedBy);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ErrorBanner>{error && 'تعذّر تحميل الدرجات.'}</ErrorBanner>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <SegmentedTabs tabs={TABS.map((t) => ({ ...t, label: `${t.label} · ${counts[t.id]}`, active: filter === t.id, onClick: () => setFilter(t.id) }))} />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="بحث باسم الطالب…"
          style={{ marginInlineStart: 'auto', maxWidth: 280 }}
        />
      </div>
      <div className="card ah-table-wrap" style={{ padding: 0 }}>
        <table className="table">
          <thead><tr><th>الطالب</th><th>الصف</th><th>التقييم</th><th>الدرجة</th><th>المعلّم</th><th></th></tr></thead>
          <tbody>
            {view.length === 0 && <EmptyRow colSpan={6}>لا توجد درجات في هذه الفئة حالياً.</EmptyRow>}
            {view.map((g) => (
              <tr key={g.id}>
                <td>{g.studentName}</td>
                <td>{g.className} <span style={{ color: 'var(--color-neutral-500)', fontSize: 12 }}>· {g.subject}</span></td>
                <td>{g.assessmentTitle}</td>
                <td className="ah-tabnum">{g.score} / {g.maxScore}</td>
                <td>{g.teacherName}</td>
                <td style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>
                  {g.status === 'قيد المراجعة' ? (
                    <>
                      <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: 12 }} disabled={busyId === g.id} onClick={() => onApprove(g)}>اعتماد</button>{' '}
                      <button className="btn btn-ghost" style={{ fontSize: 12 }} disabled={busyId === g.id} onClick={() => onReject(g)}>رفض</button>
                    </>
                  ) : (
                    <span className={`tag tag-${g.status === 'معتمد' ? 'accent' : 'neutral'}`}>{g.status}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
