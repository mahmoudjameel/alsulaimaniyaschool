import { useMemo, useState } from 'react';
import { orderBy } from 'firebase/firestore';
import Icon from '../../components/Icon';
import BackButton from '../../components/BackButton';
import SearchInput from '../../components/SearchInput';
import { ErrorBanner, EmptyRow } from '../../components/ui';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { demoBilling, demoStudents } from '../../data/demo';
import { formatILS } from '../../lib/constants';
import NewInvoiceModal from '../../modals/NewInvoiceModal';
import { matchesStudentSearch } from '../../lib/studentSearch';

const STATUS_TONE = { 'مؤكَّد': 'accent', 'قيد التأكيد': 'outline', 'مسودّة': 'neutral', 'متأخّر': 'accent2' };

export default function AccountantInvoices() {
  const { data: charges, error, demo } = useLiveOrDemo('charges', [orderBy('createdAt', 'desc')], demoBilling.charges);
  const { data: students } = useLiveOrDemo('students', [orderBy('name', 'asc')], demoStudents);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () => (charges || []).filter((c) => matchesStudentSearch(
      { ...c, name: c.student || c.studentName, studentName: c.student || c.studentName },
      search,
      ['type', 'method', 'status'],
    )),
    [charges, search],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <BackButton to="/accountant" label="عودة للوحة المحاسب" />
      <ErrorBanner>{error && 'تعذّر تحميل الفواتير.'}</ErrorBanner>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h4 style={{ margin: 0 }}>فواتير الطلاب</h4>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="بحث باسم الطالب…"
          style={{ marginInlineStart: 'auto', maxWidth: 300 }}
        />
        <button type="button" className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => setShowModal(true)}>
          <Icon name="upload_file" size={15} /> رفع فاتورة
        </button>
      </div>
      <div className="card ah-table-wrap" style={{ padding: 0 }}>
        <table className="table">
          <thead><tr><th>الطالب</th><th>نوع الرسم</th><th>المبلغ</th><th>الحالة</th><th>طريقة الدفع</th><th>الإيصال</th></tr></thead>
          <tbody>
            {filtered.length === 0 && <EmptyRow colSpan={6}>{search.trim() ? 'لا فواتير مطابقة للبحث.' : 'لا توجد فواتير مسجّلة بعد.'}</EmptyRow>}
            {filtered.map((c, i) => (
              <tr key={c.id || i}>
                <td>{c.student}</td><td>{c.type}</td>
                <td className="ah-tabnum">{c.amount || formatILS(c.amountMinorUnits)}</td>
                <td><span className={`tag tag-${c.tone || STATUS_TONE[c.status] || 'neutral'}`}>{c.status}</span></td>
                <td>{c.method}</td>
                <td>{c.receiptUrl ? <a href={c.receiptUrl} target="_blank" rel="noreferrer" className="ah-tablink" style={{ color: 'var(--gold)' }}>عرض</a> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showModal && <NewInvoiceModal students={students} demo={demo} onClose={() => setShowModal(false)} />}
    </div>
  );
}
