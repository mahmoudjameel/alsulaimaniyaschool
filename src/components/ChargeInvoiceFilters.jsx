import SearchInput from './SearchInput';
import {
  CHARGE_SECTION_OPTIONS,
  CHARGE_SORT_OPTIONS,
} from '../lib/chargeFilters';

const STATUS_OPTIONS = ['الكل', 'مؤكَّد', 'قيد التأكيد', 'مسودّة', 'متأخّر'];

/**
 * Shared filter/sort bar for admin Billing + accountant Invoices.
 */
export default function ChargeInvoiceFilters({
  search,
  onSearch,
  stageFilter,
  onStageFilter,
  sectionFilter,
  onSectionFilter,
  statusFilter,
  onStatusFilter,
  periodFilter,
  onPeriodFilter,
  periodOptions = [],
  sortId,
  onSort,
  stageLabels = [],
  resultCount,
  searchPlaceholder = 'بحث باسم الطالب…',
  trailing = null,
}) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      <SearchInput
        value={search}
        onChange={onSearch}
        placeholder={searchPlaceholder}
        style={{ flex: '1 1 220px', maxWidth: 360 }}
      />
      <select
        className="input"
        style={{ width: 'auto', fontSize: 13 }}
        value={stageFilter}
        onChange={(e) => onStageFilter(e.target.value)}
        aria-label="تصفية حسب المرحلة"
      >
        <option value="الكل">المرحلة: الكل</option>
        {stageLabels.map((g) => (
          <option key={g} value={g}>{g}</option>
        ))}
      </select>
      <select
        className="input"
        style={{ width: 'auto', fontSize: 13 }}
        value={sectionFilter}
        onChange={(e) => onSectionFilter(e.target.value)}
        aria-label="تصفية حسب الشعبة"
      >
        <option value="الكل">الشعبة: الكل</option>
        {CHARGE_SECTION_OPTIONS.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      {onPeriodFilter && (
        <select
          className="input"
          style={{ width: 'auto', fontSize: 13 }}
          value={periodFilter}
          onChange={(e) => onPeriodFilter(e.target.value)}
          aria-label="تصفية حسب الشهر"
        >
          <option value="الكل">الشهر: الكل</option>
          {periodOptions.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      )}
      {onStatusFilter && (
        <select
          className="input"
          style={{ width: 'auto', fontSize: 13 }}
          value={statusFilter}
          onChange={(e) => onStatusFilter(e.target.value)}
          aria-label="تصفية حسب الحالة"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s === 'الكل' ? 'الحالة: الكل' : s}</option>
          ))}
        </select>
      )}
      <select
        className="input"
        style={{ width: 'auto', fontSize: 13 }}
        value={sortId}
        onChange={(e) => onSort(e.target.value)}
        aria-label="ترتيب الفواتير"
      >
        {CHARGE_SORT_OPTIONS.map((o) => (
          <option key={o.id} value={o.id}>ترتيب: {o.label}</option>
        ))}
      </select>
      {resultCount != null && (
        <span className="tag tag-neutral" style={{ fontSize: 12 }}>
          {resultCount} فاتورة
        </span>
      )}
      {trailing}
    </div>
  );
}
