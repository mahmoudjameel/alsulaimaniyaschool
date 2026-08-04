import { Link } from 'react-router-dom';
import { orderBy, where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { ErrorBanner } from '../../components/ui';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { demoStudents, demoExpenses } from '../../data/demo';
import { formatILS } from '../../lib/constants';

const LINKS = [
  { to: '/accountant/invoices', icon: 'upload_file', title: 'فواتير الطلاب', body: 'رفع رسم يدوي مع إيصال.' },
  { to: '/accountant/payments', icon: 'fact_check', title: 'وصول تحويل الأولياء', body: 'اعتماد أو رفض وصل الدفع.' },
  { to: '/accountant/fee-aid', icon: 'sell', title: 'خصم وإعفاء وتقسيط', body: 'منح خصم أو إعفاء أو خطة تقسيط.' },
  { to: '/accountant/finance-report', icon: 'analytics', title: 'التقرير المالي', body: 'متأخّرات، فوترة، ومصاريف الفترة.' },
  { to: '/accountant/whatsapp', icon: 'chat', title: 'تذكير واتساب', body: 'مراسلة أولياء المتأخّرين.' },
  { to: '/accountant/payroll', icon: 'account_balance_wallet', title: 'رواتب الموظفين', body: 'احتساب واعتماد وصرف رواتب الطاقم.' },
  { to: '/accountant/staff', icon: 'badge', title: 'الموظفون والأجور', body: 'سجل الأجور الشهرية واليومية والساعة.' },
  { to: '/accountant/disbursements', icon: 'payments', title: 'سلف · ورديات · مستهلكات', body: 'فرز المدفوعات اليومية والسيولة.' },
  { to: '/accountant/expenses', icon: 'trending_down', title: 'المصاريف', body: 'كهرباء، ماء، صيانة، طوارئ…' },
  { to: '/accountant/enrollment', icon: 'assignment_ind', title: 'تسجيل بالصفوف', body: 'إضافة طالب لصف أو إزالته.' },
];

export default function AccountantDashboard() {
  const { data: students, error: sErr } = useLiveOrDemo('students', [orderBy('name', 'asc')], demoStudents);
  const { data: pendingPayments, error: pErr } = useLiveOrDemo(
    'paymentProofs',
    [where('status', '==', 'قيد المراجعة')],
    [],
  );
  const { data: expenses, error: eErr } = useLiveOrDemo(
    'expenses',
    [orderBy('createdAt', 'desc')],
    demoExpenses,
  );

  const arrearsStudents = (students || []).filter((s) => Number(s.balanceMinorUnits || 0) > 0);
  const arrearsTotal = arrearsStudents.reduce((a, s) => a + Number(s.balanceMinorUnits || 0), 0);
  const expenseTotal = (expenses || []).slice(0, 50).reduce((a, x) => a + Number(x.amountMinorUnits || 0), 0);

  const kpis = [
    { label: 'مستحقات متأخّرة', value: formatILS(arrearsTotal) },
    { label: 'طلاب بمتأخّرات', value: String(arrearsStudents.length) },
    { label: 'وصول بانتظار الاعتماد', value: String((pendingPayments || []).length) },
    { label: 'مصاريف مسجّلة (آخر دفعات)', value: formatILS(expenseTotal) },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <ErrorBanner>{(sErr || pErr || eErr) && 'تعذّر تحميل بعض إحصاءات اللوحة.'}</ErrorBanner>
      <div className="card" style={{ borderColor: 'var(--color-accent-300)', background: 'var(--color-accent-100)', padding: '14px 16px', fontSize: 13, color: 'var(--color-accent-900)' }}>
        رسوم الطلاب، الرواتب، السلف، والمصاريف.
      </div>
      <div className="ah-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
        {kpis.map((k) => (
          <div key={k.label} className="card">
            <span className="card-kicker">{k.label}</span>
            <div className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 24 }}>{k.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {LINKS.map((l) => (
          <Link key={l.to} to={l.to} className="card" style={{ textDecoration: 'none', color: 'inherit', gap: 10 }}>
            <Icon name={l.icon} size={22} color="var(--gold)" />
            <div className="card-title">{l.title}</div>
            <div className="card-body">{l.body}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
