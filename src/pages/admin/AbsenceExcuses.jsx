import { useMemo, useState } from 'react';
import { orderBy } from 'firebase/firestore';
import Icon from '../../components/Icon';
import SearchInput from '../../components/SearchInput';
import { EmptyRow, ErrorBanner } from '../../components/ui';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { useAuth } from '../../context/AuthContext';
import { reviewAbsenceExcuse } from '../../services/aid';
import { ABSENCE_REMINDER_TEMPLATE, openWhatsAppChat, parseStoredPhone } from '../../lib/phone';
import { SCHOOL_NAME_AR } from '../../lib/constants';
import { demoStudents } from '../../data/demo';
import { matchesStudentSearch } from '../../lib/studentSearch';

export default function AbsenceExcuses() {
  const { profile } = useAuth();
  const { data, error, demo } = useLiveOrDemo('absenceExcuses', [orderBy('createdAt', 'desc')], []);
  const { data: students } = useLiveOrDemo('students', [orderBy('name', 'asc')], demoStudents);
  const [busyId, setBusyId] = useState(null);
  const [search, setSearch] = useState('');

  const rows = useMemo(() => (data || []).filter((row) => {
    const student = students.find((s) => s.id === row.studentId);
    return matchesStudentSearch({ ...row, ...(student || {}) }, search);
  }), [data, students, search]);

  const onReview = async (row, decision) => {
    if (demo) return;
    setBusyId(row.id);
    try {
      await reviewAbsenceExcuse(row.id, {
        decision,
        reviewer: { uid: profile?.id, name: profile?.name },
      });
    } finally {
      setBusyId(null);
    }
  };

  const remind = (row) => {
    const student = students.find((s) => s.id === row.studentId);
    if (!student) return;
    const parsed = parseStoredPhone(student);
    openWhatsAppChat(parsed, ABSENCE_REMINDER_TEMPLATE(SCHOOL_NAME_AR, row.studentName, row.date));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ErrorBanner>{error && 'تعذّر تحميل طلبات التبرير.'}</ErrorBanner>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <h4 style={{ margin: 0 }}>تبريرات الغياب</h4>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="بحث باسم الطالب أو الهوية…"
          style={{ marginInlineStart: 'auto', maxWidth: 320 }}
        />
      </div>
      <div className="card ah-table-wrap" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr><th>الطالب</th><th>التاريخ</th><th>السبب</th><th>ولي الأمر</th><th>الحالة</th><th /></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={6}>{search.trim() ? 'لا نتائج مطابقة.' : 'لا طلبات بعد.'}</EmptyRow>}
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.studentName}</td>
                <td className="ah-tabnum">{row.date}</td>
                <td>
                  <div>{row.reason}</div>
                  {row.note && <div style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>{row.note}</div>}
                </td>
                <td>{row.guardianName || '—'}</td>
                <td><span className="tag tag-neutral">{row.status}</span></td>
                <td style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>
                  <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => remind(row)}>واتساب</button>
                  {row.status === 'قيد المراجعة' && (
                    <>
                      <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} disabled={busyId === row.id} onClick={() => onReview(row, 'approve')}>قبول</button>
                      <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} disabled={busyId === row.id} onClick={() => onReview(row, 'reject')}>رفض</button>
                    </>
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
