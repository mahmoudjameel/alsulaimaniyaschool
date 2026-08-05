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
import { CURRENT_ACADEMIC_YEAR, formatILS } from '../../lib/constants';
import { currentPeriod, periodLabel } from '../../lib/staff';
import {
  filterAndSortCharges,
  formatChargeStageLabel,
  studentsByIdMap,
} from '../../lib/chargeFilters';

const STATUS_TONE = { 'مؤكَّد': 'accent', 'قيد التأكيد': 'outline', 'مسودّة': 'neutral', 'متأخّر': 'accent2' };

export default function Billing() {
  const { data: charges, error, demo } = useLiveOrDemo('charges', [orderBy('createdAt', 'desc')], demoBilling.charges);
  const { data: students } = useLiveOrDemo('students', [orderBy('name', 'asc')], demoStudents);
  const { stages, labels: stageLabels } = useAcademicStages();
  const [period, setPeriod] = useState(currentPeriod());
  const [generating, setGenerating] = useState(false);
  const [genMessage, setGenMessage] = useState('');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('الكل');
  const [sectionFilter, setSectionFilter] = useState('الكل');
  const [statusFilter, setStatusFilter] = useState('الكل');
  const [sortId, setSortId] = useState('newest');

  const studentMap = useMemo(() => studentsByIdMap(students), [students]);

  const filteredCharges = useMemo(
    () => filterAndSortCharges(charges, {
      search, stageFilter, sectionFilter, statusFilter, sortId, students,
    }),
    [charges, search, stageFilter, sectionFilter, statusFilter, sortId, students],
  );

  const onGenerate = async () => {
    setGenerating(true);
    setGenMessage('');
    try {
      if (demo) {
        setGenMessage('وضع العرض التوضيحي: صِل مشروع Firebase لتوليد الفواتير فعلياً حسب رسوم كل مرحلة.');
      } else {
        const res = await generateInvoices(period);
        setGenMessage(`تم: ${res.created ?? 0} فاتورة جديدة · تُخطّي ${res.skipped ?? 0} (موجودة مسبقاً) — الفترة ${periodLabel(period)}.`);
      }
    } catch {
      setGenMessage('تعذّر توليد الفواتير.');
    } finally {
      setGenerating(false);
    }
  };

  const hasFilters = search.trim() || stageFilter !== 'الكل' || sectionFilter !== 'الكل' || statusFilter !== 'الكل';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <BackButton to="/admin" label="عودة للوحة القيادة" />
      <ErrorBanner>{error && 'تعذّر تحميل الفواتير.'}</ErrorBanner>

      <div className="card">
        <div className="card-title" style={{ marginBottom: 8 }}>الرسوم الشهرية حسب المرحلة</div>
        <div style={{ fontSize: 13, color: 'var(--color-neutral-600)', marginBottom: 12 }}>
          تُدار من <Link to="/admin/stages" style={{ color: 'var(--gold)' }}>المراحل الدراسية</Link> — عند التوليد تُفرض على كل طالب حسب مرحلته.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          {stages.length === 0 && <div style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>لا مراحل بعد — أضفها من شاشة المراحل.</div>}
          {stages.map((s) => (
            <div key={s.id} style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{s.labelAr}</div>
              <div className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 20, color: 'var(--gold)', marginTop: 4 }}>
                {s.monthlyTuitionMinorUnits != null ? formatILS(s.monthlyTuitionMinorUnits) : '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>/ شهر</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h4 style={{ margin: 0 }}>توليد فواتير شهرية</h4>
        <input className="input" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} style={{ width: 'auto', fontSize: 13 }} dir="ltr" />
        <span style={{ marginInlineStart: 'auto' }} />
        <Link to="/admin/payments" className="btn btn-secondary" style={{ fontSize: 13, textDecoration: 'none' }}>
          <Icon name="fact_check" size={14} /> وصول الدفع
        </Link>
        <Link to="/admin/stages" className="btn btn-secondary" style={{ fontSize: 13, textDecoration: 'none' }}>تعديل رسوم المراحل</Link>
        <button type="button" className="btn btn-primary" style={{ fontSize: 13 }} onClick={onGenerate} disabled={generating}>
          <Icon name="sync" size={14} /> {generating ? 'جارٍ التوليد…' : `توليد فواتير ${periodLabel(period)}`}
        </button>
      </div>
      {genMessage && <div style={{ fontSize: 13, color: 'var(--color-accent-700)' }}>{genMessage}</div>}

      <div className="ah-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        {demoBilling.kpis.map((k) => (
          <div key={k.label} className="card"><span className="card-kicker">{k.label}</span><div className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 26 }}>{k.value}</div></div>
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
              <th>نوع الرسم</th>
              <th>المبلغ</th>
              <th>الخصم/المنحة</th>
              <th>الحالة</th>
              <th>طريقة الدفع</th>
            </tr>
          </thead>
          <tbody>
            {filteredCharges.length === 0 && (
              <EmptyRow colSpan={7}>{hasFilters ? 'لا فواتير مطابقة للفلتر.' : 'لا توجد فواتير.'}</EmptyRow>
            )}
            {filteredCharges.map((c, i) => (
              <tr key={c.id || i}>
                <td>{c.student}</td>
                <td style={{ fontSize: 13 }}>{formatChargeStageLabel(c, studentMap)}</td>
                <td>{c.type}</td>
                <td className="ah-tabnum">{c.amount || formatILS(c.amountMinorUnits)}</td>
                <td className="ah-tabnum" style={{ color: 'var(--color-neutral-500)' }}>{c.discount || (c.discountMinorUnits ? `− ${formatILS(c.discountMinorUnits)}` : '—')}</td>
                <td><span className={`tag tag-${c.tone || STATUS_TONE[c.status] || 'neutral'}`}>{c.status}</span></td>
                <td>{c.method}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card" style={{ borderColor: 'var(--color-accent-300)', background: 'var(--color-accent-100)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Icon name="verified_user" size={18} color="var(--color-accent-800)" />
          <div style={{ fontSize: 13, color: 'var(--color-accent-900)' }}>
            التوليد <strong>غير مكرَّر</strong> لكل طالب/شهر. العام الدراسي الحالي: {CURRENT_ACADEMIC_YEAR}.
          </div>
        </div>
      </div>
    </div>
  );
}
