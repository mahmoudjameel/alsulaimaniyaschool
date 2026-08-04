import { useMemo, useState } from 'react';
import { orderBy } from 'firebase/firestore';
import { Link, useLocation } from 'react-router-dom';
import { SegmentedTabs, ErrorBanner, EmptyRow } from '../../components/ui';
import Icon from '../../components/Icon';
import BackButton from '../../components/BackButton';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { demoPayroll } from '../../data/demo';
import { advancePayrollStage } from '../../services/finance';
import { formatILS } from '../../lib/constants';
import { staffPortalBase } from '../../lib/portalPaths';
import { currentPeriod, periodLabel, staffRoleLabel } from '../../lib/staff';

const STAGES = [
  { id: 'open', label: 'مفتوحة', statusLabel: 'مسودّة', action: 'احتساب الكل' },
  { id: 'computed', label: 'محتسبة', statusLabel: 'محتسب', action: 'اعتماد الكل' },
  { id: 'approved', label: 'معتمدة', statusLabel: 'معتمد', action: 'ترحيل الدفع' },
  { id: 'paid', label: 'مدفوعة', statusLabel: 'مدفوع', action: 'تصدير كشف' },
];

export default function Payroll() {
  const { pathname } = useLocation();
  const base = staffPortalBase(pathname);
  const [filter, setFilter] = useState('computed');
  const [period, setPeriod] = useState(currentPeriod());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const { data, error, demo } = useLiveOrDemo('payroll', [orderBy('name', 'asc')], demoPayroll);
  const stage = STAGES.find((s) => s.id === filter);
  const view = useMemo(() => data.filter((p) => (p.stage || 'computed') === filter && (!p.period || p.period === period || demo)), [data, filter, period, demo]);

  const onAction = async () => {
    setBusy(true);
    setMessage('');
    try {
      if (demo) setMessage('وضع العرض التوضيحي — صِل Firebase للاحتساب الفعلي.');
      else {
        await advancePayrollStage(period, filter);
        setMessage('تم تنفيذ الإجراء.');
      }
    } catch {
      setMessage('تعذّر تنفيذ الإجراء.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <BackButton to={base} label="رجوع" />
      <ErrorBanner>{error && 'تعذّر تحميل بيانات الرواتب.'}</ErrorBanner>
      <div className="card" style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-neutral-700)' }}>
        الرواتب تُحسب من <Link to={`${base}/staff`} style={{ color: 'var(--gold)' }}>سجل الموظفين</Link> (شهري / يومي / ساعة).
        السلف والورديات والمستهلكات من <Link to={`${base}/disbursements`} style={{ color: 'var(--gold)' }}>المدفوعات والتصنيف</Link>.
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <SegmentedTabs tabs={STAGES.map((s) => ({ ...s, active: filter === s.id, onClick: () => setFilter(s.id) }))} />
        <input className="input" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} style={{ width: 'auto', fontSize: 13 }} dir="ltr" />
        <span style={{ marginInlineStart: 'auto' }} />
        <span className="tag tag-neutral">{periodLabel(period)}</span>
        <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={onAction} disabled={busy}>{busy ? 'جارٍ التنفيذ…' : stage.action}</button>
      </div>
      {message && <div style={{ fontSize: 13, color: 'var(--color-accent-700)' }}>{message}</div>}
      <div className="card ah-table-wrap" style={{ padding: 0 }}>
        <table className="table">
          <thead><tr><th>الموظف</th><th>النوع</th><th>أيام / ساعات</th><th>الأساسي</th><th>بدلات/حسومات</th><th>الصافي</th><th>الحالة</th></tr></thead>
          <tbody>
            {view.length === 0 && <EmptyRow colSpan={7}>لا يوجد موظفون في هذه المرحلة — أضف موظفين ثم اضغط احتساب.</EmptyRow>}
            {view.map((p, i) => (
              <tr key={p.id || i}>
                <td>
                  <div>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>
                    {p.role}{p.roleType ? ` · ${staffRoleLabel(p.roleType)}` : ''}
                  </div>
                </td>
                <td>{p.type}</td>
                <td className="ah-tabnum">{p.days}</td>
                <td className="ah-tabnum">{p.base || formatILS(p.baseMinorUnits)}</td>
                <td className="ah-tabnum" style={{ color: 'var(--color-neutral-500)' }}>{p.adj || (p.adjustmentMinorUnits ? formatILS(p.adjustmentMinorUnits) : '—')}</td>
                <td className="ah-tabnum" style={{ fontWeight: 600 }}>{p.net || formatILS(p.netMinorUnits)}</td>
                <td><span className="tag tag-neutral">{stage.statusLabel}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card" style={{ borderStyle: 'dashed' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Icon name="link" size={17} color="var(--gold)" />
          <div style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>
            لأيام العمل والساعات: من شاشة الموظفين ← «حضور/ساعات» لكل فترة. الأجر بالساعة = أجر الساعة × الساعات المسجّلة.
          </div>
        </div>
      </div>
    </div>
  );
}
