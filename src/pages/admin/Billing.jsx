import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { orderBy } from 'firebase/firestore';
import Icon from '../../components/Icon';
import BackButton from '../../components/BackButton';
import ChargeInvoiceFilters from '../../components/ChargeInvoiceFilters';
import { ErrorBanner, EmptyRow } from '../../components/ui';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { useAcademicStages } from '../../hooks/useAcademicStages';
import { demoBilling, demoStudents } from '../../data/demo';
import { generateInvoices } from '../../services/finance';
import { formatILS } from '../../lib/constants';
import { useAcademicYearLabel } from '../../components/AcademicYearText';
import { currentPeriod, periodLabel } from '../../lib/staff';
import {
  filterAndSortCharges,
  formatChargeStageLabel,
  formatChargeTypeLabel,
  formatChargePeriodLabel,
  uniqueChargePeriods,
  studentsByIdMap,
} from '../../lib/chargeFilters';
import EditInvoiceModal from '../../modals/EditInvoiceModal';

const STATUS_TONE = { 'مؤكَّد': 'accent', 'قيد التأكيد': 'outline', 'مسودّة': 'neutral', 'متأخّر': 'accent2' };
const COLLECTED_STATUSES = new Set(['مؤكَّد', 'معتمد', 'paid', 'collected']);

export default function Billing() {
  const { data: charges, error, demo } = useLiveOrDemo('charges', [orderBy('createdAt', 'desc')], demoBilling.charges);
  const { data: students } = useLiveOrDemo('students', [orderBy('name', 'asc')], demoStudents);
  const { stages, labels: stageLabels } = useAcademicStages();
  const { academicYear } = useAcademicYearLabel();
  const [period, setPeriod] = useState(currentPeriod());
  const [generating, setGenerating] = useState(false);
  const [genMessage, setGenMessage] = useState('');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('الكل');
  const [sectionFilter, setSectionFilter] = useState('الكل');
  const [statusFilter, setStatusFilter] = useState('الكل');
  const [periodFilter, setPeriodFilter] = useState('الكل');
  const [sortId, setSortId] = useState('period_asc');
  const [editingCharge, setEditingCharge] = useState(null);

  const studentMap = useMemo(() => studentsByIdMap(students), [students]);
  const periodOptions = useMemo(() => uniqueChargePeriods(charges), [charges]);

  const filteredCharges = useMemo(
    () => filterAndSortCharges(charges, {
      search, stageFilter, sectionFilter, statusFilter, periodFilter, sortId, students,
    }),
    [charges, search, stageFilter, sectionFilter, statusFilter, periodFilter, sortId, students],
  );

  const kpis = useMemo(() => {
    const forPeriod = (charges || []).filter((c) => !c.period || c.period === period);
    const billed = forPeriod.reduce((a, c) => a + Number(c.amountMinorUnits || 0), 0);
    const discounts = forPeriod.reduce((a, c) => a + Number(c.discountMinorUnits || 0), 0);
    const collected = forPeriod
      .filter((c) => COLLECTED_STATUSES.has(c.status))
      .reduce((a, c) => a + Math.max(0, Number(c.amountMinorUnits || 0) - Number(c.discountMinorUnits || 0)), 0);
    const outstandingFromCharges = forPeriod
      .filter((c) => !COLLECTED_STATUSES.has(c.status))
      .reduce((a, c) => a + Math.max(0, Number(c.amountMinorUnits || 0) - Number(c.discountMinorUnits || 0)), 0);
    const outstandingFromBalances = (students || []).reduce(
      (a, s) => a + Math.max(0, Number(s.balanceMinorUnits || 0)),
      0,
    );
    const outstanding = outstandingFromBalances > 0 ? outstandingFromBalances : outstandingFromCharges;

    return [
      { label: 'مفوتر (الفترة)', value: formatILS(billed) },
      { label: 'محصّل ومؤكَّد', value: formatILS(collected) },
      { label: 'منح وخصومات', value: formatILS(discounts) },
      { label: 'قائم', value: formatILS(outstanding) },
    ];
  }, [charges, students, period]);

  const onGenerate = async () => {
    setGenerating(true);
    setGenMessage('');
    try {
      if (demo) {
        setGenMessage('وضع العرض التوضيحي: صِل مشروع Firebase لإصدار الفواتير فعلياً حسب رسوم كل مرحلة.');
      } else {
        const res = await generateInvoices(period);
        setGenMessage(`تم: ${res.created ?? 0} فاتورة جديدة · تُخطّي ${res.skipped ?? 0} (موجودة مسبقاً) — الفترة ${periodLabel(period)}.`);
      }
    } catch {
      setGenMessage('تعذّر إصدار الفواتير.');
    } finally {
      setGenerating(false);
    }
  };

  const hasFilters = search.trim() || stageFilter !== 'الكل' || sectionFilter !== 'الكل' || statusFilter !== 'الكل' || periodFilter !== 'الكل';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <BackButton to="/admin" label="عودة للوحة القيادة" />
      <ErrorBanner>{error && 'تعذّر تحميل الفواتير.'}</ErrorBanner>

      <div className="card">
        <div className="card-title" style={{ marginBottom: 8 }}>رسوم المرحلة: شهري ≠ حجز مقعد</div>
        <div style={{ fontSize: 13, color: 'var(--color-neutral-600)', marginBottom: 12 }}>
          تُدار من <Link to="/admin/stages" style={{ color: 'var(--gold)' }}>المراحل الدراسية</Link>.
          {' '}إصدار الفواتير الشهرية يفرض الرسوم الشهرية فقط — حجز المقعد له سجل منفصل.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          {stages.length === 0 && <div style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>لا مراحل بعد — أضفها من شاشة المراحل.</div>}
          {stages.map((s) => (
            <div key={s.id} style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{s.labelAr}</div>
              <div className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 18, color: 'var(--gold)', marginTop: 4 }}>
                {s.monthlyTuitionMinorUnits != null ? formatILS(s.monthlyTuitionMinorUnits) : '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>/ شهر × ١٠</div>
              <div style={{ fontSize: 12, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
                حجز مقعد:{' '}
                <strong className="ah-tabnum">
                  {s.seatReservationMinorUnits != null ? formatILS(s.seatReservationMinorUnits) : '—'}
                </strong>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h4 style={{ margin: 0 }}>إصدار فواتير شهرية</h4>
        <input className="input" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} style={{ width: 'auto', fontSize: 13 }} dir="ltr" />
        <span style={{ marginInlineStart: 'auto' }} />
        <Link to="/admin/seat-reservations" className="btn btn-primary" style={{ fontSize: 13, textDecoration: 'none' }}>
          <Icon name="event" size={14} /> سجل حجز المقعد
        </Link>
        <Link to="/admin/payments" className="btn btn-secondary" style={{ fontSize: 13, textDecoration: 'none' }}>
          <Icon name="fact_check" size={14} /> وصول الدفع
        </Link>
        <Link to="/admin/stages" className="btn btn-secondary" style={{ fontSize: 13, textDecoration: 'none' }}>تعديل رسوم المراحل</Link>
        <button type="button" className="btn btn-primary" style={{ fontSize: 13 }} onClick={onGenerate} disabled={generating}>
          <Icon name="sync" size={14} /> {generating ? 'جارٍ الإصدار…' : `إصدار فواتير ${periodLabel(period)}`}
        </button>
      </div>
      {genMessage && <div style={{ fontSize: 13, color: 'var(--color-accent-700)' }}>{genMessage}</div>}

      <div className="ah-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        {kpis.map((k) => (
          <div key={k.label} className="card">
            <span className="card-kicker">{k.label}</span>
            <div className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 26 }}>{k.value}</div>
            <div style={{ fontSize: 11, color: 'var(--color-neutral-500)', marginTop: 4 }}>{periodLabel(period)}</div>
          </div>
        ))}
      </div>

      <div>
        <h4 style={{ margin: '0 0 10px' }}>سجل الفواتير</h4>
        <ChargeInvoiceFilters
          search={search}
          onSearch={setSearch}
          stageFilter={stageFilter}
          onStageFilter={setStageFilter}
          sectionFilter={sectionFilter}
          onSectionFilter={setSectionFilter}
          statusFilter={statusFilter}
          onStatusFilter={setStatusFilter}
          periodFilter={periodFilter}
          onPeriodFilter={setPeriodFilter}
          periodOptions={periodOptions}
          sortId={sortId}
          onSort={setSortId}
          stageLabels={stageLabels}
          resultCount={filteredCharges.length}
          searchPlaceholder="بحث في الفواتير باسم الطالب…"
        />
      </div>

      <div className="card ah-table-wrap" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>الطالب</th>
              <th>المرحلة</th>
              <th>الشهر</th>
              <th>الفاتورة</th>
              <th>المبلغ</th>
              <th>الخصم/المنحة</th>
              <th>الحالة</th>
              <th>طريقة الدفع</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredCharges.length === 0 && (
              <EmptyRow colSpan={9}>{hasFilters ? 'لا فواتير مطابقة للفلتر.' : 'لا توجد فواتير.'}</EmptyRow>
            )}
            {filteredCharges.map((c, i) => (
              <tr key={c.id || i}>
                <td>{c.student}</td>
                <td style={{ fontSize: 13 }}>{formatChargeStageLabel(c, studentMap)}</td>
                <td style={{ fontSize: 13 }}>{formatChargePeriodLabel(c) || '—'}</td>
                <td>{formatChargeTypeLabel(c)}</td>
                <td className="ah-tabnum">{c.amount || formatILS(c.amountMinorUnits)}</td>
                <td className="ah-tabnum" style={{ color: 'var(--color-neutral-500)' }}>{c.discount || (c.discountMinorUnits ? `− ${formatILS(c.discountMinorUnits)}` : '—')}</td>
                <td><span className={`tag tag-${c.tone || STATUS_TONE[c.status] || 'neutral'}`}>{c.status}</span></td>
                <td>{c.method}</td>
                <td style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: 12 }}
                    onClick={() => setEditingCharge(c)}
                    disabled={demo || !c.id}
                  >
                    <Icon name="edit" size={14} /> تعديل
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editingCharge && (
        <EditInvoiceModal
          charge={editingCharge}
          demo={demo}
          onClose={() => setEditingCharge(null)}
        />
      )}
      <div className="card" style={{ borderColor: 'var(--color-accent-300)', background: 'var(--color-accent-100)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Icon name="verified_user" size={18} color="var(--color-accent-800)" />
          <div style={{ fontSize: 13, color: 'var(--color-accent-900)' }}>
            الإصدار <strong>غير مكرَّر</strong> لكل طالب/شهر. العام الدراسي الحالي: {academicYear}. الأرقام أعلاه من الفواتير الحقيقية في النظام.
          </div>
        </div>
      </div>
    </div>
  );
}
