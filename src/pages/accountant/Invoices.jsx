import { useMemo, useState } from 'react';
import { orderBy } from 'firebase/firestore';
import Icon from '../../components/Icon';
import BackButton from '../../components/BackButton';
import ChargeInvoiceFilters from '../../components/ChargeInvoiceFilters';
import { ErrorBanner, EmptyRow } from '../../components/ui';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { useAcademicStages } from '../../hooks/useAcademicStages';
import { demoBilling, demoStudents } from '../../data/demo';
import { formatILS } from '../../lib/constants';
import NewInvoiceModal from '../../modals/NewInvoiceModal';
import {
  filterAndSortCharges,
  formatChargeStageLabel,
  studentsByIdMap,
} from '../../lib/chargeFilters';

const STATUS_TONE = { 'مؤكَّد': 'accent', 'قيد التأكيد': 'outline', 'مسودّة': 'neutral', 'متأخّر': 'accent2' };

export default function AccountantInvoices() {
  const { data: charges, error, demo } = useLiveOrDemo('charges', [orderBy('createdAt', 'desc')], demoBilling.charges);
  const { data: students } = useLiveOrDemo('students', [orderBy('name', 'asc')], demoStudents);
  const { labels: stageLabels } = useAcademicStages();
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('الكل');
  const [sectionFilter, setSectionFilter] = useState('الكل');
  const [statusFilter, setStatusFilter] = useState('الكل');
  const [sortId, setSortId] = useState('newest');

  const studentMap = useMemo(() => studentsByIdMap(students), [students]);

  const filtered = useMemo(
    () => filterAndSortCharges(charges, {
      search, stageFilter, sectionFilter, statusFilter, sortId, students,
    }),
    [charges, search, stageFilter, sectionFilter, statusFilter, sortId, students],
  );

  const hasFilters = search.trim() || stageFilter !== 'الكل' || sectionFilter !== 'الكل' || statusFilter !== 'الكل';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <BackButton to="/accountant" label="عودة للوحة المحاسب" />
      <ErrorBanner>{error && 'تعذّر تحميل الفواتير.'}</ErrorBanner>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h4 style={{ margin: 0 }}>فواتير الطلاب</h4>
        <span style={{ marginInlineStart: 'auto' }} />
        <button type="button" className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => setShowModal(true)}>
          <Icon name="upload_file" size={15} /> رفع فاتورة
        </button>
      </div>
      <ChargeInvoiceFilters
        search={search}
        onSearch={setSearch}
        stageFilter={stageFilter}
        onStageFilter={setStageFilter}
        sectionFilter={sectionFilter}
        onSectionFilter={setSectionFilter}
        statusFilter={statusFilter}
        onStatusFilter={setStatusFilter}
        sortId={sortId}
        onSort={setSortId}
        stageLabels={stageLabels}
        resultCount={filtered.length}
        searchPlaceholder="بحث باسم الطالب…"
      />
      <div className="card ah-table-wrap" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>الطالب</th>
              <th>المرحلة</th>
              <th>نوع الرسم</th>
              <th>المبلغ</th>
              <th>الحالة</th>
              <th>طريقة الدفع</th>
              <th>الإيصال</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <EmptyRow colSpan={7}>{hasFilters ? 'لا فواتير مطابقة للفلتر.' : 'لا توجد فواتير مسجّلة بعد.'}</EmptyRow>
            )}
            {filtered.map((c, i) => (
              <tr key={c.id || i}>
                <td>{c.student}</td>
                <td style={{ fontSize: 13 }}>{formatChargeStageLabel(c, studentMap)}</td>
                <td>{c.type}</td>
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
