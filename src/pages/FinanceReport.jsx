import { useMemo } from 'react';
import { orderBy } from 'firebase/firestore';
import { Link, useLocation } from 'react-router-dom';
import Icon from '../components/Icon';
import BackButton from '../components/BackButton';
import { ErrorBanner } from '../components/ui';
import { useLiveOrDemo } from '../hooks/useFirestore';
import { formatILS } from '../lib/constants';
import { demoStudents, demoBilling } from '../data/demo';
import { currentPeriod, periodLabel } from '../lib/staff';
import { staffPortalBase } from '../lib/portalPaths';

export default function FinanceReport() {
  const { pathname } = useLocation();
  const base = staffPortalBase(pathname);
  const { data: students, error: e1 } = useLiveOrDemo('students', [orderBy('name', 'asc')], demoStudents);
  const { data: charges, error: e2 } = useLiveOrDemo('charges', [orderBy('createdAt', 'desc')], demoBilling.charges);
  const { data: expenses, error: e3 } = useLiveOrDemo('expenses', [orderBy('createdAt', 'desc')], demoBilling.expenses || []);
  const { data: disbursements } = useLiveOrDemo('disbursements', [orderBy('createdAt', 'desc')], []);
  const period = currentPeriod();

  const stats = useMemo(() => {
    const arrearsStudents = (students || []).filter((s) => Number(s.balanceMinorUnits || 0) > 0);
    const arrearsTotal = arrearsStudents.reduce((a, s) => a + Number(s.balanceMinorUnits || 0), 0);
    const billed = (charges || []).reduce((a, c) => a + Number(c.amountMinorUnits || 0), 0);
    const discounts = (charges || []).reduce((a, c) => a + Number(c.discountMinorUnits || 0), 0);
    const expenseTotal = (expenses || []).reduce((a, x) => a + Number(x.amountMinorUnits || 0), 0);
    const disbursed = (disbursements || []).reduce((a, x) => a + Number(x.amountMinorUnits || 0), 0);
    const byStage = {};
    arrearsStudents.forEach((s) => {
      const key = s.stageLabel || s.grade || 'غير محدد';
      byStage[key] = (byStage[key] || 0) + Number(s.balanceMinorUnits || 0);
    });
    return {
      arrearsStudents,
      arrearsTotal,
      billed,
      discounts,
      expenseTotal,
      disbursed,
      byStage: Object.entries(byStage).sort((a, b) => b[1] - a[1]),
      collectionHint: billed > 0 ? Math.max(0, Math.round((1 - arrearsTotal / Math.max(billed, 1)) * 100)) : null,
    };
  }, [students, charges, expenses, disbursements]);

  const exportCsv = () => {
    const lines = [['الطالب', 'المرحلة', 'ولي الأمر', 'الهاتف', 'المستحق_أغورة']];
    stats.arrearsStudents.forEach((s) => {
      lines.push([
        s.name,
        s.grade || '',
        s.guardianName || '',
        s.guardianPhoneE164 || s.guardianPhone || '',
        String(s.balanceMinorUnits || 0),
      ]);
    });
    const csv = lines.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arrears-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <BackButton to={base} label="رجوع" />
      <ErrorBanner>{(e1 || e2 || e3) && 'تعذّر تحميل بعض بيانات التقرير.'}</ErrorBanner>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <h4 style={{ margin: 0 }}>التقرير المالي</h4>
          <div style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>الفترة الحالية: {periodLabel(period)}</div>
        </div>
        <span style={{ marginInlineStart: 'auto' }} />
        <Link to={`${base}/whatsapp`} className="btn btn-secondary" style={{ fontSize: 13, textDecoration: 'none' }}>
          <Icon name="chat" size={14} /> تذكير واتساب للمتأخرين
        </Link>
        <button type="button" className="btn btn-primary" style={{ fontSize: 13 }} onClick={exportCsv}>
          <Icon name="download" size={14} /> تصدير المتأخرات CSV
        </button>
      </div>

      <div className="ah-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        <Kpi label="إجمالي المتأخرات" value={formatILS(stats.arrearsTotal)} />
        <Kpi label="عدد الأسر/الطلاب المتأخرين" value={stats.arrearsStudents.length} />
        <Kpi label="إجمالي المفوتر (كل الفواتير)" value={formatILS(stats.billed)} />
        <Kpi label="مصاريف + صرفيات" value={formatILS(stats.expenseTotal + stats.disbursed)} />
      </div>

      <div className="ah-g2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <div className="card-title" style={{ marginBottom: 10 }}>المتأخرات حسب المرحلة</div>
          {stats.byStage.length === 0 && <div style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>لا متأخرات.</div>}
          {stats.byStage.map(([stage, amount]) => (
            <div key={stage} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 13 }}>
              <span>{stage}</span>
              <span className="ah-tabnum" style={{ color: 'var(--gold)' }}>{formatILS(amount)}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-title" style={{ marginBottom: 10 }}>ملخّص</div>
          <Row label="خصومات على الفواتير" value={formatILS(stats.discounts)} />
          <Row label="المصاريف" value={formatILS(stats.expenseTotal)} />
          <Row label="سلف/ورديات/مستهلكات" value={formatILS(stats.disbursed)} />
          <Row label="مؤشر تقريبي للتحصيل" value={stats.collectionHint != null ? `${stats.collectionHint}%` : '—'} />
        </div>
      </div>

      <div className="card ah-table-wrap" style={{ padding: 0 }}>
        <table className="table">
          <thead><tr><th>الطالب</th><th>المرحلة</th><th>ولي الأمر</th><th>المستحق</th></tr></thead>
          <tbody>
            {stats.arrearsStudents.slice(0, 50).map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.grade}</td>
                <td>{s.guardianName || '—'}</td>
                <td className="ah-tabnum">{formatILS(s.balanceMinorUnits)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value }) {
  return (
    <div className="card">
      <span className="card-kicker">{label}</span>
      <div className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 26, color: 'var(--gold)' }}>{value}</div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 13 }}>
      <span style={{ color: 'var(--color-neutral-600)' }}>{label}</span>
      <span className="ah-tabnum">{value}</span>
    </div>
  );
}
