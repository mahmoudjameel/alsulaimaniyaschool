import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { orderBy, limit as fbLimit, where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { ErrorBanner, Kpi } from '../../components/ui';
import { demoDashboard } from '../../data/demo';
import { useAuth } from '../../context/AuthContext';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { adminPermissionForPath } from '../../layouts/AdminLayout';
import { iconForActivity } from '../../services/activity';
import { relativeFromTimestamp, relativeHoursAr } from '../../lib/relativeTime';
import { formatILS } from '../../lib/constants';

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function isInMonth(ts, key) {
  if (!ts) return false;
  const d = typeof ts?.toDate === 'function' ? ts.toDate() : new Date(ts);
  if (Number.isNaN(d.getTime())) return false;
  return monthKey(d) === key;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { can, isFirebaseConfigured } = useAuth();
  const demo = demoDashboard;
  const currentMonth = monthKey();

  const { data: students, error: studentsErr, demo: studentsDemo } = useLiveOrDemo('students', [], []);
  const { data: proofs, error: proofsErr } = useLiveOrDemo('paymentProofs', [orderBy('createdAt', 'desc'), fbLimit(200)], []);
  const { data: expenses, error: expensesErr } = useLiveOrDemo('expenses', [orderBy('createdAt', 'desc'), fbLimit(200)], []);
  const { data: admissions } = useLiveOrDemo('admissions', [where('status', '==', 'review')], []);
  const { data: activity, demo: activityDemo } = useLiveOrDemo(
    'activityLog',
    [orderBy('createdAt', 'desc'), fbLimit(6)],
    demo.activity,
  );

  const live = isFirebaseConfigured && !studentsDemo;

  const kpis = useMemo(() => {
    if (!live) return demo.kpis;

    const activeStudents = (students || []).filter((s) => s.status !== 'متخرّج' && s.active !== false);
    const approvedThisMonth = (proofs || []).filter((p) => (
      (p.status === 'معتمد' || p.status === 'approved') && isInMonth(p.reviewedAt || p.updatedAt || p.createdAt, currentMonth)
    ));
    const revenueMinor = approvedThisMonth.reduce((a, p) => a + Number(p.amountMinorUnits || 0), 0);
    const arrearsStudents = (students || []).filter((s) => Number(s.balanceMinorUnits || 0) > 0);
    const arrearsMinor = arrearsStudents.reduce((a, s) => a + Number(s.balanceMinorUnits || 0), 0);
    const expenseThisMonth = (expenses || []).filter((x) => isInMonth(x.createdAt || x.date, currentMonth));
    const expenseMinor = expenseThisMonth.reduce((a, x) => a + Number(x.amountMinorUnits || 0), 0);
    const netMinor = revenueMinor - expenseMinor;

    return [
      {
        label: 'إجمالي الطلاب',
        value: String(activeStudents.length),
        delta: activeStudents.length === 0 ? 'لا طلاب بعد المسح' : `${activeStudents.length} مسجّل`,
        icon: 'group',
      },
      {
        label: 'إيراد الشهر',
        value: formatILS(revenueMinor),
        delta: `${approvedThisMonth.length} دفعة معتمدة`,
        icon: 'trending_up',
      },
      {
        label: 'المستحقات القائمة',
        value: formatILS(arrearsMinor),
        delta: arrearsStudents.length ? `${arrearsStudents.length} طالباً بمتأخّرات` : 'لا متأخّرات',
        icon: 'schedule',
      },
      {
        label: 'صافي النتيجة',
        value: formatILS(netMinor),
        delta: 'إيراد الشهر − مصاريف الشهر',
        icon: 'balance',
      },
    ];
  }, [live, students, proofs, expenses, currentMonth, demo.kpis]);

  const collect = useMemo(() => {
    if (!live) return demo.collect;
    const approved = (proofs || []).filter((p) => p.status === 'معتمد' || p.status === 'approved');
    const pending = (proofs || []).filter((p) => p.status === 'قيد المراجعة' || p.status === 'pending');
    const approvedMinor = approved.reduce((a, p) => a + Number(p.amountMinorUnits || 0), 0);
    const pendingMinor = pending.reduce((a, p) => a + Number(p.amountMinorUnits || 0), 0);
    const arrearsMinor = (students || []).reduce((a, s) => a + Math.max(0, Number(s.balanceMinorUnits || 0)), 0);
    const total = approvedMinor + pendingMinor + arrearsMinor || 1;
    return [
      { label: 'محصّل ومؤكَّد', amount: formatILS(approvedMinor), pct: Math.min(100, Math.round((approvedMinor / total) * 100)), color: 'var(--color-accent-600)' },
      { label: 'قيد الانتظار', amount: formatILS(pendingMinor), pct: Math.min(100, Math.round((pendingMinor / total) * 100)), color: 'var(--color-neutral-500)' },
      { label: 'متأخّر', amount: formatILS(arrearsMinor), pct: Math.min(100, Math.round((arrearsMinor / total) * 100)), color: 'var(--color-accent-800)' },
    ];
  }, [live, proofs, students, demo.collect]);

  const collectionRate = useMemo(() => {
    if (!live) return demo.collectionRate;
    const approvedMinor = (proofs || [])
      .filter((p) => p.status === 'معتمد' || p.status === 'approved')
      .reduce((a, p) => a + Number(p.amountMinorUnits || 0), 0);
    const arrearsMinor = (students || []).reduce((a, s) => a + Math.max(0, Number(s.balanceMinorUnits || 0)), 0);
    const denom = approvedMinor + arrearsMinor;
    if (!denom) return '—';
    return `${Math.round((approvedMinor / denom) * 100)}%`;
  }, [live, proofs, students, demo.collectionRate]);

  const todos = useMemo(() => {
    const base = live
      ? [
          { icon: 'assignment', label: 'طلبات تسجيل بانتظار المراجعة', count: (admissions || []).length, to: '/admin/admissions' },
          {
            icon: 'receipt_long',
            label: 'دفعات بانتظار التأكيد',
            count: (proofs || []).filter((p) => p.status === 'قيد المراجعة' || p.status === 'pending').length,
            to: '/admin/billing',
          },
        ]
      : demo.todo;

    return base.filter((t) => {
      if (!isFirebaseConfigured) return true;
      const perm = adminPermissionForPath(t.to);
      return !perm || can(perm);
    });
  }, [live, admissions, proofs, demo.todo, can, isFirebaseConfigured]);

  const canFinance = !isFirebaseConfigured || can('billing.manage');
  const canActivity = !isFirebaseConfigured || can('activity.view');
  const loadError = studentsErr || proofsErr || expensesErr;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <ErrorBanner>{loadError && 'تعذّر تحميل بعض إحصاءات اللوحة.'}</ErrorBanner>

      {live && (
        <div className="card" style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-neutral-700)', background: 'var(--color-accent-100)', borderColor: 'var(--color-accent-300)' }}>
          الأرقام أدناه من البيانات الفعلية في النظام (بعد المسح تظهر أصفاراً حتى تضيف بيانات حقيقية).
        </div>
      )}

      <div className="ah-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        {kpis.map((k) => <Kpi key={k.label} {...k} />)}
      </div>

      {canFinance && (
        <div className="ah-2col" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div className="card-title">الإيراد مقابل المصروف</div>
              <span className="tag tag-outline">{live ? 'من البيانات الحالية' : 'آخر 8 أشهر'}</span>
            </div>
            {live ? (
              <div style={{ padding: '28px 8px', fontSize: 14, color: 'var(--color-neutral-600)', lineHeight: 1.7 }}>
                الرسم البياني التاريخي يظهر بعد تراكم أشهر من الفواتير والمصاريف.
                حالياً: إيراد هذا الشهر {kpis[1]?.value} · صافي {kpis[3]?.value}.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 200, paddingTop: 10 }}>
                  {demo.chartBars.map((b) => (
                    <div key={b.m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                      <div style={{ width: '100%', display: 'flex', gap: 3, alignItems: 'flex-end', height: '100%' }}>
                        <div style={{ flex: 1, background: 'var(--color-accent-200)', borderTop: '2px solid var(--gold)', height: `${b.rev}%` }} />
                        <div style={{ flex: 1, background: 'transparent', border: '1px solid var(--color-neutral-400)', borderBottom: 0, height: `${b.exp}%` }} />
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--color-neutral-500)' }}>{b.m}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 18, fontSize: 12, marginTop: 10, color: 'var(--color-neutral-600)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, background: 'var(--color-accent-200)', borderTop: '2px solid var(--gold)' }} />الإيراد</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, border: '1px solid var(--color-neutral-400)' }} />المصروف</span>
                </div>
              </>
            )}
          </div>
          <div className="card">
            <div className="card-title" style={{ marginBottom: 6 }}>حالة التحصيل</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 6 }}>
              {collect.map((c) => (
                <div key={c.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                    <span>{c.label}</span><span className="ah-tabnum" style={{ color: c.color }}>{c.amount}</span>
                  </div>
                  <div style={{ height: 7, background: 'var(--color-neutral-200)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${c.pct}%`, background: c.color }} />
                  </div>
                </div>
              ))}
            </div>
            <hr className="hr" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 13, color: 'var(--color-neutral-600)' }}>نسبة التحصيل</span>
              <span className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 28, color: 'var(--gold)' }}>{collectionRate}</span>
            </div>
          </div>
        </div>
      )}

      <div className="ah-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {canActivity && (
          <div className="card">
            <div className="card-title" style={{ marginBottom: 8 }}>النشاط الأخير</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {activity.length === 0 && <div style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>لا توجد حركات مسجّلة بعد.</div>}
              {activity.map((a, i) => (
                <div key={a.id || i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ width: 32, height: 32, flex: 'none', border: '1px solid var(--line)', borderRadius: '50%', display: 'grid', placeItems: 'center', color: 'var(--gold)' }}>
                    <Icon name={a.icon || iconForActivity(a.type)} size={15} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13 }}>{a.text || a.summary}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>
                      {activityDemo ? relativeHoursAr(a.hoursAgo) : relativeFromTimestamp(a.createdAt)} · {a.who || a.actorName}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {!activityDemo && (
              <button className="btn btn-ghost" style={{ fontSize: 12, marginTop: 8 }} onClick={() => navigate('/admin/activity')}>عرض سجلّ الحركات كاملاً ←</button>
            )}
          </div>
        )}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 8 }}>بانتظار إجرائك</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
            {todos.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>لا توجد مهام ضمن صلاحياتك حالياً.</div>
            )}
            {todos.map((t) => (
              <button key={t.label} onClick={() => navigate(t.to)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', background: 'transparent', cursor: 'pointer', textAlign: 'right', width: '100%' }}>
                <Icon name={t.icon} size={17} color="var(--gold)" />
                <span style={{ flex: 1, fontSize: 13 }}>{t.label}</span>
                <span className="tag tag-accent ah-tabnum">{t.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
