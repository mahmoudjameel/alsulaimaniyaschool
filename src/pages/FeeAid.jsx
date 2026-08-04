import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { orderBy } from 'firebase/firestore';
import Icon from '../components/Icon';
import BackButton from '../components/BackButton';
import Modal from '../components/Modal';
import { EmptyRow, ErrorBanner, Field, SegmentedTabs } from '../components/ui';
import { useLiveOrDemo } from '../hooks/useFirestore';
import { useAuth } from '../context/AuthContext';
import { CURRENT_ACADEMIC_YEAR, formatILS, shekelsToMinorUnits } from '../lib/constants';
import { currentPeriod, periodLabel } from '../lib/staff';
import { relativeDaysAr, relativeFromTimestamp } from '../lib/relativeTime';
import {
  applyStudentDiscount,
  cancelInstallmentPlan,
  createInstallmentPlan,
  DISCOUNT_KIND_LABELS,
  markInstallmentPaid,
  postInstallmentDue,
} from '../services/aid';
import {
  demoInstallmentPlans,
  demoInstallments,
  demoStudentDiscounts,
  demoStudents,
} from '../data/demo';
import SearchInput from '../components/SearchInput';
import { matchesStudentSearch, filterByStudentSearch } from '../lib/studentSearch';

const TABS = [
  { id: 'overview', label: 'نظرة عامة' },
  { id: 'arrears', label: 'المستحقات' },
  { id: 'discounts', label: 'الخصومات والإعفاءات' },
  { id: 'plans', label: 'خطط التقسيط' },
];

const DISCOUNT_KINDS = Object.entries(DISCOUNT_KIND_LABELS)
  .filter(([id]) => id !== 'full')
  .map(([id, label]) => ({ id, label }));

const INST_TONE = {
  مجدول: 'neutral', مستحق: 'outline', مدفوع: 'accent', ملغى: 'accent2',
};
const PLAN_TONE = {
  نشط: 'accent', مكتمل: 'neutral', ملغى: 'accent2',
};

/** Overlay demo mutations onto live/demo seed rows without duplicating ids. */
function mergeWithOverlay(raw, overlays, isDemo) {
  if (!isDemo || !overlays?.length) return raw;
  const byId = new Map(overlays.map((o) => [o.id, o]));
  const merged = raw.map((row) => (byId.has(row.id) ? { ...row, ...byId.get(row.id) } : row));
  const rawIds = new Set(raw.map((r) => r.id));
  const extras = overlays.filter((o) => !rawIds.has(o.id));
  return [...extras, ...merged];
}

export default function FeeAid() {
  const { pathname } = useLocation();
  const { profile } = useAuth();
  const actor = { uid: profile?.id, name: profile?.name, role: profile?.role };

  const { data: students, error, demo } = useLiveOrDemo('students', [orderBy('name', 'asc')], demoStudents);
  const { data: discountsRaw } = useLiveOrDemo('studentDiscounts', [orderBy('createdAt', 'desc')], demoStudentDiscounts);
  const { data: plansRaw } = useLiveOrDemo('installmentPlans', [orderBy('createdAt', 'desc')], demoInstallmentPlans);
  const { data: installmentsRaw } = useLiveOrDemo('installments', [orderBy('period', 'asc')], demoInstallments);

  const [tab, setTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [expandedPlan, setExpandedPlan] = useState(null);
  const [showDiscount, setShowDiscount] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const [prefillStudentId, setPrefillStudentId] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [demoDisc, setDemoDisc] = useState([]);
  const [demoPlans, setDemoPlans] = useState([]);
  const [demoInst, setDemoInst] = useState([]);

  const discounts = useMemo(() => mergeWithOverlay(discountsRaw, demoDisc, demo), [discountsRaw, demo, demoDisc]);
  const plans = useMemo(() => mergeWithOverlay(plansRaw, demoPlans, demo), [plansRaw, demo, demoPlans]);
  const installments = useMemo(() => mergeWithOverlay(installmentsRaw, demoInst, demo), [installmentsRaw, demo, demoInst]);

  const q = search.trim();

  const arrears = useMemo(() => {
    let list = (students || [])
      .filter((s) => Number(s.balanceMinorUnits || 0) > 0)
      .sort((a, b) => Number(b.balanceMinorUnits) - Number(a.balanceMinorUnits));
    if (q) list = list.filter((s) => matchesStudentSearch(s, q));
    return list;
  }, [students, q]);

  const filteredDiscounts = useMemo(() => {
    let list = discounts;
    if (kindFilter !== 'all') list = list.filter((d) => d.kind === kindFilter);
    if (q) {
      list = list.filter((d) => matchesStudentSearch(d, q, ['reason', 'kindLabel', 'reference', 'createdByName']));
    }
    return list;
  }, [discounts, kindFilter, q]);

  const filteredPlans = useMemo(() => {
    let list = plans;
    if (planFilter !== 'all') list = list.filter((p) => p.status === planFilter);
    if (q) list = list.filter((p) => matchesStudentSearch(p, q, ['notes', 'status']));
    return list;
  }, [plans, planFilter, q]);

  const stats = useMemo(() => {
    const discountTotal = discounts.reduce((s, d) => s + Number(d.amountMinorUnits || 0), 0);
    const byKind = {};
    discounts.forEach((d) => {
      const k = d.kindLabel || d.kind || 'أخرى';
      byKind[k] = (byKind[k] || 0) + Number(d.amountMinorUnits || 0);
    });
    const activePlans = plans.filter((p) => p.status === 'نشط').length;
    const dueInst = installments.filter((i) => i.status === 'مستحق');
    const dueTotal = dueInst.reduce((s, i) => s + Number(i.amountMinorUnits || 0), 0);
    const paidInst = installments.filter((i) => i.status === 'مدفوع');
    const paidTotal = paidInst.reduce((s, i) => s + Number(i.amountMinorUnits || 0), 0);
    const arrearsTotal = arrears.reduce((s, x) => s + Number(x.balanceMinorUnits || 0), 0);
    return {
      arrearsCount: arrears.length,
      arrearsTotal,
      discountCount: discounts.length,
      discountTotal,
      byKind,
      activePlans,
      planCount: plans.length,
      dueCount: dueInst.length,
      dueTotal,
      paidCount: paidInst.length,
      paidTotal,
    };
  }, [discounts, plans, installments, arrears]);

  const openDiscount = (studentId = '') => {
    setPrefillStudentId(studentId);
    setShowDiscount(true);
  };
  const openPlan = (studentId = '') => {
    setPrefillStudentId(studentId);
    setShowPlan(true);
  };

  const instForPlan = (planId) =>
    installments
      .filter((i) => i.planId === planId)
      .sort((a, b) => (a.index || 0) - (b.index || 0));

  const onPostDue = async (inst) => {
    setBusyId(inst.id);
    setMessage('');
    try {
      if (demo) {
        setDemoInst((prev) => [...prev.filter((x) => x.id !== inst.id), { ...inst, status: 'مستحق' }]);
        setMessage(`تم ترحيل القسط ${inst.index} كمستحق (عرض توضيحي).`);
      } else {
        await postInstallmentDue(inst.id, { actor });
        setMessage(`تم ترحيل القسط ${inst.index} إلى المستحقات.`);
      }
    } catch {
      setMessage('تعذّر ترحيل القسط.');
    } finally {
      setBusyId(null);
    }
  };

  const onMarkPaid = async (inst) => {
    setBusyId(inst.id);
    setMessage('');
    try {
      if (demo) {
        setDemoInst((prev) => [...prev.filter((x) => x.id !== inst.id), { ...inst, status: 'مدفوع' }]);
        setMessage(`تم تسجيل سداد القسط ${inst.index} (عرض توضيحي).`);
      } else {
        await markInstallmentPaid(inst.id, { actor });
        setMessage(`تم تسجيل سداد القسط ${inst.index}.`);
      }
    } catch {
      setMessage('تعذّر تسجيل السداد.');
    } finally {
      setBusyId(null);
    }
  };

  const onCancelPlan = async (plan) => {
    if (!window.confirm(`إلغاء الأقساط المجدولة لخطة ${plan.studentName}؟`)) return;
    setBusyId(plan.id);
    setMessage('');
    try {
      if (demo) {
        setDemoPlans((prev) => [...prev.filter((p) => p.id !== plan.id), { ...plan, status: 'ملغى' }]);
        setDemoInst((prev) => {
          const map = new Map(prev.map((x) => [x.id, x]));
          installments.filter((i) => i.planId === plan.id && i.status === 'مجدول').forEach((i) => {
            map.set(i.id, { ...i, status: 'ملغى' });
          });
          return [...map.values()];
        });
        setMessage('أُلغيت الخطة (عرض توضيحي).');
      } else {
        await cancelInstallmentPlan(plan.id, { actor, reason: 'إلغاء من شاشة المساعدات' });
        setMessage('أُلغيت الأقساط المجدولة المتبقية.');
      }
    } catch {
      setMessage('تعذّر إلغاء الخطة.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <BackButton to={pathname.startsWith('/accountant') ? '/accountant/invoices' : '/admin/billing'} label="عودة للفواتير" />
      <ErrorBanner>{error && 'تعذّر تحميل بيانات الطلاب أو المساعدات.'}</ErrorBanner>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 240px' }}>
          <h4 style={{ margin: '0 0 4px' }}>خصم · إعفاء · تقسيط</h4>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-neutral-600)', lineHeight: 1.7 }}>
            إدارة كاملة للمنح والإعفاءات الإنسانية وخصم الإخوة والموظفين، مع خطط تقسيط شهرية ومتابعة كل قسط حتى السداد — العام {CURRENT_ACADEMIC_YEAR}.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" style={{ fontSize: 13 }} onClick={() => openPlan()}>
          <Icon name="calendar_month" size={14} /> خطة تقسيط جديدة
        </button>
        <button type="button" className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => openDiscount()}>
          <Icon name="sell" size={14} /> خصم / إعفاء جديد
        </button>
      </div>

      <SegmentedTabs tabs={TABS.map((t) => ({
        ...t,
        active: tab === t.id,
        onClick: () => setTab(t.id),
        label: t.id === 'arrears' ? `${t.label} · ${stats.arrearsCount}`
          : t.id === 'discounts' ? `${t.label} · ${stats.discountCount}`
            : t.id === 'plans' ? `${t.label} · ${stats.planCount}`
              : t.label,
      }))} />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="بحث: اسم، هوية، رقم دراسي، ولي أمر…"
          style={{ maxWidth: 360 }}
        />
        {tab === 'discounts' && (
          <select className="input" style={{ maxWidth: 180, fontSize: 13 }} value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
            <option value="all">كل أنواع الخصم</option>
            {DISCOUNT_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
            <option value="full">إعفاء كامل</option>
          </select>
        )}
        {tab === 'plans' && (
          <select className="input" style={{ maxWidth: 160, fontSize: 13 }} value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
            <option value="all">كل الحالات</option>
            <option value="نشط">نشط</option>
            <option value="مكتمل">مكتمل</option>
            <option value="ملغى">ملغى</option>
          </select>
        )}
      </div>

      {message && (
        <div style={{ fontSize: 13, color: 'var(--color-accent-700)', padding: '10px 14px', background: 'var(--color-accent-100)', borderRadius: 'var(--radius-md)' }}>
          {message}
        </div>
      )}

      {tab === 'overview' && (
        <>
          <div className="ah-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
            <Kpi label="طلاب عليهم مستحقات" value={stats.arrearsCount} />
            <Kpi label="إجمالي المتأخرات" value={formatILS(stats.arrearsTotal)} gold />
            <Kpi label="خصومات / إعفاءات" value={stats.discountCount} />
            <Kpi label="قيمة الخصومات" value={formatILS(stats.discountTotal)} gold />
            <Kpi label="خطط تقسيط نشطة" value={stats.activePlans} />
            <Kpi label="أقساط مستحقة الآن" value={`${stats.dueCount} · ${formatILS(stats.dueTotal)}`} />
            <Kpi label="أقساط مُسدَّدة" value={`${stats.paidCount} · ${formatILS(stats.paidTotal)}`} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="ah-g2">
            <div className="card">
              <div className="card-title" style={{ marginBottom: 12 }}>توزيع الخصومات حسب النوع</div>
              {Object.keys(stats.byKind).length === 0 && (
                <div style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>لا خصومات مسجّلة بعد.</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(stats.byKind).sort((a, b) => b[1] - a[1]).map(([label, amount]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
                    <span>{label}</span>
                    <span className="ah-tabnum" style={{ fontWeight: 600 }}>{formatILS(amount)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-title" style={{ marginBottom: 12 }}>أقساط مستحقة بحاجة متابعة</div>
              {installments.filter((i) => i.status === 'مستحق').length === 0 && (
                <div style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>لا أقساط مستحقة حالياً.</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {installments.filter((i) => i.status === 'مستحق').slice(0, 6).map((i) => (
                    <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13 }}>
                      <strong>{i.studentName}</strong>
                      <span style={{ color: 'var(--color-neutral-500)' }}>قسط {i.index}/{i.ofTotal} · {periodLabel(i.period)}</span>
                      <span className="ah-tabnum" style={{ marginInlineStart: 'auto' }}>{formatILS(i.amountMinorUnits)}</span>
                      <button type="button" className="btn btn-primary" style={{ fontSize: 11 }} disabled={busyId === i.id} onClick={() => onMarkPaid(i)}>
                        تسجيل سداد
                      </button>
                    </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title" style={{ marginBottom: 8 }}>كيف تعمل الشاشة؟</div>
            <ul style={{ margin: 0, paddingInlineStart: 20, fontSize: 13, lineHeight: 1.85, color: 'var(--color-neutral-700)' }}>
              <li><strong>خصم / إعفاء:</strong> مبلغ ثابت، أو نسبة من المستحق، أو إعفاء كامل — يُقيَّد فوراً في دفتر الطالب ويُخفّض الرصيد.</li>
              <li><strong>تقسيط:</strong> تقسم المبلغ على 2–12 شهراً مع جدول واضح؛ يمكن ترحيل كل قسط للمستحق ثم تسجيل السداد.</li>
              <li><strong>المستحقات:</strong> قائمة حية بكل من عليهم رصيد، مع اختصار لتطبيق خصم أو فتح خطة تقسيط للطالب مباشرة.</li>
            </ul>
          </div>
        </>
      )}

      {tab === 'arrears' && (
        <div className="card ah-table-wrap" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>الطالب</th>
                <th>الرقم</th>
                <th>المرحلة</th>
                <th>ولي الأمر</th>
                <th>الهاتف</th>
                <th>المستحق</th>
                <th>خطط نشطة</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {arrears.length === 0 && <EmptyRow colSpan={8}>لا مستحقات مطابقة للبحث.</EmptyRow>}
              {arrears.map((s) => {
                const active = plans.filter((p) => p.studentId === s.id && p.status === 'نشط').length;
                return (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td dir="ltr">{s.displayId || '—'}</td>
                    <td>{s.grade || s.stageLabel || '—'}</td>
                    <td>{s.guardianName || '—'}</td>
                    <td dir="ltr" style={{ fontSize: 12 }}>{s.guardianPhoneLocal || s.guardianPhone || '—'}</td>
                    <td className="ah-tabnum" style={{ fontWeight: 700, color: 'var(--gold)' }}>{formatILS(s.balanceMinorUnits)}</td>
                    <td>{active > 0 ? <span className="tag tag-accent">{active}</span> : '—'}</td>
                    <td style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>
                      <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => openDiscount(s.id)}>خصم</button>
                      <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => openPlan(s.id)}>تقسيط</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'discounts' && (
        <div className="card ah-table-wrap" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>الطالب</th>
                <th>النوع</th>
                <th>الوضع</th>
                <th>المبلغ</th>
                <th>السبب</th>
                <th>المرجع</th>
                <th>العام</th>
                <th>بواسطة</th>
                <th>التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {filteredDiscounts.length === 0 && <EmptyRow colSpan={9}>لا خصومات مسجّلة بعد — ابدأ بـ «خصم / إعفاء جديد».</EmptyRow>}
              {filteredDiscounts.map((d) => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 600 }}>{d.studentName}</td>
                  <td><span className="tag tag-outline">{d.kindLabel || DISCOUNT_KIND_LABELS[d.kind] || d.kind}</span></td>
                  <td style={{ fontSize: 12 }}>
                    {d.mode === 'full' ? 'إعفاء كامل' : d.mode === 'percent' ? `نسبة ${d.percent}%` : 'مبلغ ثابت'}
                  </td>
                  <td className="ah-tabnum" style={{ fontWeight: 600 }}>{formatILS(d.amountMinorUnits)}</td>
                  <td style={{ maxWidth: 200, fontSize: 12 }}>{d.reason || '—'}{d.notes ? ` · ${d.notes}` : ''}</td>
                  <td style={{ fontSize: 12 }}>{d.reference || '—'}</td>
                  <td style={{ fontSize: 12 }}>{d.academicYear || '—'}</td>
                  <td style={{ fontSize: 12 }}>{d.createdByName || '—'}</td>
                  <td style={{ fontSize: 12 }}>{d.daysAgo != null ? relativeDaysAr(d.daysAgo) : relativeFromTimestamp(d.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--color-neutral-600)', borderTop: '1px solid var(--line)' }}>
            إجمالي المعروض: <strong className="ah-tabnum">{formatILS(filteredDiscounts.reduce((s, d) => s + Number(d.amountMinorUnits || 0), 0))}</strong>
            {' · '}{filteredDiscounts.length} سجل
          </div>
        </div>
      )}

      {tab === 'plans' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredPlans.length === 0 && (
            <div className="card" style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>
              لا خطط تقسيط بعد — أنشئ خطة من الزر أعلاه أو من صف المستحقات.
            </div>
          )}
          {filteredPlans.map((plan) => {
            const rows = instForPlan(plan.id);
            const open = expandedPlan === plan.id;
            const paid = rows.filter((r) => r.status === 'مدفوع').length;
            const due = rows.filter((r) => r.status === 'مستحق').length;
            const scheduled = rows.filter((r) => r.status === 'مجدول').length;
            return (
              <div key={plan.id} className="card" style={{ gap: 0, padding: 0, overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => setExpandedPlan(open ? null : plan.id)}
                  style={{
                    all: 'unset', cursor: 'pointer', display: 'grid',
                    gridTemplateColumns: '1fr auto', gap: 12, padding: '14px 16px',
                    alignItems: 'center', boxSizing: 'border-box', width: '100%',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <strong style={{ fontSize: 15 }}>{plan.studentName}</strong>
                      <span className={`tag tag-${PLAN_TONE[plan.status] || 'neutral'}`}>{plan.status}</span>
                      <span style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>
                        {plan.months} أقساط · من {periodLabel(plan.startPeriod)}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>
                      الإجمالي {formatILS(plan.totalMinorUnits)}
                      {' · '}قسط تقريبي {formatILS(plan.installmentMinorUnits)}
                      {' · '}مدفوع {paid} · مستحق {due} · مجدول {scheduled}
                      {plan.notes ? ` · ${plan.notes}` : ''}
                    </div>
                  </div>
                  <Icon name={open ? 'expand_less' : 'expand_more'} size={22} />
                </button>

                {open && (
                  <div style={{ borderTop: '1px solid var(--line)' }}>
                    <div className="ah-table-wrap" style={{ padding: 0 }}>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>الفترة</th>
                            <th>المبلغ</th>
                            <th>الحالة</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {rows.length === 0 && <EmptyRow colSpan={5}>لا أقساط مرتبطة.</EmptyRow>}
                          {rows.map((i) => (
                            <tr key={i.id}>
                              <td>{i.index}/{i.ofTotal || plan.months}</td>
                              <td>{periodLabel(i.period)}</td>
                              <td className="ah-tabnum">{formatILS(i.amountMinorUnits)}</td>
                              <td><span className={`tag tag-${INST_TONE[i.status] || 'neutral'}`}>{i.status}</span></td>
                              <td style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>
                                {i.status === 'مجدول' && plan.status === 'نشط' && (
                                  <>
                                    <button type="button" className="btn btn-ghost" style={{ fontSize: 11 }} disabled={busyId === i.id} onClick={() => onPostDue(i)}>ترحيل مستحق</button>
                                    <button type="button" className="btn btn-ghost" style={{ fontSize: 11 }} disabled={busyId === i.id} onClick={() => onMarkPaid(i)}>سداد مباشر</button>
                                  </>
                                )}
                                {i.status === 'مستحق' && (
                                  <button type="button" className="btn btn-primary" style={{ fontSize: 11 }} disabled={busyId === i.id} onClick={() => onMarkPaid(i)}>تسجيل سداد</button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ padding: '10px 16px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 12, color: 'var(--color-neutral-600)' }}>
                      <span>العام {plan.academicYear || CURRENT_ACADEMIC_YEAR}</span>
                      {plan.createdByName && <span>· بواسطة {plan.createdByName}</span>}
                      <span style={{ marginInlineStart: 'auto' }} />
                      {plan.status === 'نشط' && scheduled > 0 && (
                        <button type="button" className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--color-accent-2-700)' }} disabled={busyId === plan.id} onClick={() => onCancelPlan(plan)}>
                          إلغاء الأقساط المجدولة
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showDiscount && (
        <DiscountModal
          students={students}
          demo={demo}
          actor={actor}
          initialStudentId={prefillStudentId}
          onClose={() => setShowDiscount(false)}
          onDemoSaved={(row) => {
            setDemoDisc((p) => [row, ...p]);
            setMessage('تم تطبيق الخصم (عرض توضيحي).');
            setShowDiscount(false);
          }}
          onSaved={() => {
            setMessage('تم تطبيق الخصم/الإعفاء وتحديث رصيد الطالب.');
            setShowDiscount(false);
            setTab('discounts');
          }}
        />
      )}
      {showPlan && (
        <InstallmentModal
          students={students}
          demo={demo}
          actor={actor}
          initialStudentId={prefillStudentId}
          onClose={() => setShowPlan(false)}
          onDemoSaved={({ plan, insts }) => {
            setDemoPlans((p) => [plan, ...p]);
            setDemoInst((p) => [...insts, ...p]);
            setMessage('أُنشئت خطة التقسيط (عرض توضيحي).');
            setShowPlan(false);
            setTab('plans');
            setExpandedPlan(plan.id);
          }}
          onSaved={() => {
            setMessage('أُنشئت خطة التقسيط.');
            setShowPlan(false);
            setTab('plans');
          }}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, gold }) {
  return (
    <div className="card" style={{ gap: 4 }}>
      <span className="card-kicker">{label}</span>
      <div className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 22, color: gold ? 'var(--gold)' : undefined, lineHeight: 1.2 }}>
        {value}
      </div>
    </div>
  );
}

function DiscountModal({ students, demo, actor, initialStudentId, onClose, onSaved, onDemoSaved }) {
  const [studentId, setStudentId] = useState(initialStudentId || students[0]?.id || '');
  const [pickerSearch, setPickerSearch] = useState('');
  const [mode, setMode] = useState('amount');
  const [kind, setKind] = useState('hardship');
  const [amount, setAmount] = useState('');
  const [percent, setPercent] = useState('50');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const studentOptions = useMemo(() => filterByStudentSearch(students, pickerSearch), [students, pickerSearch]);
  const student = students.find((s) => s.id === studentId);
  const balance = Number(student?.balanceMinorUnits || 0);

  const computed = useMemo(() => {
    if (mode === 'full') return balance;
    if (mode === 'percent') return Math.round(balance * (Math.min(100, Math.max(0, Number(percent) || 0)) / 100));
    return shekelsToMinorUnits(amount);
  }, [mode, amount, percent, balance]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!studentId) { setError('اختر طالباً.'); return; }
    if (mode !== 'full' && mode !== 'percent' && !amount) { setError('أدخل المبلغ.'); return; }
    if (computed <= 0) { setError(mode === 'full' ? 'لا رصيد مستحق لإعفائه.' : 'المبلغ غير صالح.'); return; }
    setSubmitting(true);
    setError('');
    try {
      if (demo) {
        onDemoSaved({
          id: `demo-d-${Date.now()}`,
          studentId,
          studentName: student?.name,
          amountMinorUnits: computed,
          mode,
          percent: mode === 'percent' ? Number(percent) : null,
          kind: mode === 'full' ? 'full' : kind,
          kindLabel: mode === 'full' ? 'إعفاء كامل' : DISCOUNT_KIND_LABELS[kind],
          reason,
          reference,
          notes,
          academicYear: CURRENT_ACADEMIC_YEAR,
          status: 'مفعّل',
          createdByName: actor?.name || '—',
          daysAgo: 0,
        });
        return;
      }
      await applyStudentDiscount({
        studentId,
        studentName: student?.name,
        amountShekels: amount,
        percent,
        mode,
        balanceMinorUnits: balance,
        kind,
        reason,
        reference,
        notes,
        actor,
      });
      onSaved();
    } catch {
      setError('تعذّر تطبيق الخصم. تحقق من الصلاحيات والرصيد.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="تطبيق خصم أو إعفاء" onClose={onClose} onSubmit={onSubmit} submitLabel="تطبيق الآن" submitting={submitting} error={error} width={560}>
      <div className="dialog-body">
        يُسجَّل في سجل الخصومات ودفتر الطالب، ويُخفَّض الرصيد المستحق فوراً. اختر مبلغاً ثابتاً، أو نسبة من المستحق الحالي، أو إعفاءً كاملاً.
      </div>
      <SearchInput
        value={pickerSearch}
        onChange={setPickerSearch}
        placeholder="بحث سريع بالاسم أو الهوية…"
        style={{ maxWidth: '100%', marginBottom: 8 }}
      />
      <Field label="الطالب">
        <select className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
          {studentOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}{s.displayId ? ` (${s.displayId})` : ''}{s.nationalId ? ` · ${s.nationalId}` : ''} — مستحق {formatILS(s.balanceMinorUnits)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="طريقة الحساب">
        <select className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="amount">مبلغ ثابت (₪)</option>
          <option value="percent">نسبة من المستحق الحالي</option>
          <option value="full">إعفاء كامل للمستحق</option>
        </select>
      </Field>
      {mode !== 'full' && (
        <Field label="نوع الخصم / الإعفاء">
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
            {DISCOUNT_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        </Field>
      )}
      {mode === 'amount' && (
        <Field label="المبلغ (₪)">
          <input className="input" type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required dir="ltr" style={{ textAlign: 'right' }} />
        </Field>
      )}
      {mode === 'percent' && (
        <Field label="النسبة (%)">
          <input className="input" type="number" min="1" max="100" value={percent} onChange={(e) => setPercent(e.target.value)} required dir="ltr" style={{ textAlign: 'right' }} />
        </Field>
      )}
      <div style={{ fontSize: 13, padding: '10px 12px', background: 'var(--color-accent-100)', borderRadius: 'var(--radius-md)' }}>
        سيُخصم من الرصيد: <strong className="ah-tabnum">{formatILS(computed)}</strong>
        {student && <> · الرصيد الحالي {formatILS(balance)} ← بعد التطبيق {formatILS(Math.max(0, balance - computed))}</>}
      </div>
      <Field label="السبب (إلزامي للإعفاء الإنساني)">
        <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: وضع إنساني — عائلة نازحة" required={kind === 'hardship' || mode === 'full'} />
      </Field>
      <div className="site-grid-2">
        <Field label="رقم القرار / المرجع">
          <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="قرار-…" />
        </Field>
        <Field label="ملاحظات إضافية">
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="اختياري" />
        </Field>
      </div>
    </Modal>
  );
}

function InstallmentModal({ students, demo, actor, initialStudentId, onClose, onSaved, onDemoSaved }) {
  const defaultStudent = students.find((s) => s.id === initialStudentId) || students[0];
  const [studentId, setStudentId] = useState(defaultStudent?.id || '');
  const [pickerSearch, setPickerSearch] = useState('');
  const [total, setTotal] = useState(() => {
    const b = Number(defaultStudent?.balanceMinorUnits || 0);
    return b > 0 ? String(b / 100) : '';
  });
  const [months, setMonths] = useState('3');
  const [startPeriod, setStartPeriod] = useState(currentPeriod());
  const [postFirst, setPostFirst] = useState(true);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const studentOptions = useMemo(() => filterByStudentSearch(students, pickerSearch), [students, pickerSearch]);
  const student = students.find((s) => s.id === studentId);

  const schedule = useMemo(() => {
    const t = shekelsToMinorUnits(total);
    const n = Math.max(2, Math.min(12, Number(months) || 2));
    if (!t) return [];
    const per = Math.floor(t / n);
    const rem = t - per * n;
    const [y, m] = (startPeriod || currentPeriod()).split('-').map(Number);
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(y, m - 1 + i, 1);
      const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return {
        index: i + 1,
        period,
        amountMinorUnits: per + (i === n - 1 ? rem : 0),
        status: i === 0 && postFirst ? 'مستحق' : 'مجدول',
      };
    });
  }, [total, months, startPeriod, postFirst]);

  const onStudentChange = (id) => {
    setStudentId(id);
    const s = students.find((x) => x.id === id);
    const b = Number(s?.balanceMinorUnits || 0);
    if (b > 0) setTotal(String(b / 100));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!studentId || !total) { setError('اختر طالباً ومبلغاً.'); return; }
    if (schedule.length < 2) { setError('التقسيط من شهرين إلى 12.'); return; }
    setSubmitting(true);
    setError('');
    try {
      if (demo) {
        const planId = `demo-plan-${Date.now()}`;
        const n = schedule.length;
        onDemoSaved({
          plan: {
            id: planId,
            studentId,
            studentName: student?.name,
            totalMinorUnits: shekelsToMinorUnits(total),
            months: n,
            installmentMinorUnits: schedule[0]?.amountMinorUnits,
            startPeriod,
            status: 'نشط',
            notes,
            academicYear: CURRENT_ACADEMIC_YEAR,
            paidCount: 0,
            createdByName: actor?.name || '—',
            daysAgo: 0,
          },
          insts: schedule.map((row, idx) => ({
            id: `${planId}-${idx}`,
            planId,
            studentId,
            studentName: student?.name,
            index: row.index,
            ofTotal: n,
            amountMinorUnits: row.amountMinorUnits,
            period: row.period,
            status: row.status,
          })),
        });
        return;
      }
      await createInstallmentPlan({
        studentId,
        studentName: student?.name,
        totalShekels: total,
        months,
        startPeriod,
        actor,
        postFirst,
        notes,
      });
      onSaved();
    } catch {
      setError('تعذّر إنشاء خطة التقسيط.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="خطة تقسيط جديدة" onClose={onClose} onSubmit={onSubmit} submitLabel="إنشاء الخطة" submitting={submitting} error={error} width={580}>
      <div className="dialog-body">
        يُقسَّم المبلغ على الأشهر أدناه. القسط الأخير يستوعب أي فرق تقريب. العام {CURRENT_ACADEMIC_YEAR}.
      </div>
      <SearchInput
        value={pickerSearch}
        onChange={setPickerSearch}
        placeholder="بحث سريع بالاسم أو الهوية…"
        style={{ maxWidth: '100%', marginBottom: 8 }}
      />
      <Field label="الطالب">
        <select className="input" value={studentId} onChange={(e) => onStudentChange(e.target.value)}>
          {studentOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}{s.displayId ? ` (${s.displayId})` : ''} — مستحق {formatILS(s.balanceMinorUnits)}
            </option>
          ))}
        </select>
      </Field>
      <div className="site-grid-2">
        <Field label="إجمالي المبلغ المقسَّط (₪)">
          <input className="input" type="number" min="1" step="0.01" value={total} onChange={(e) => setTotal(e.target.value)} required dir="ltr" style={{ textAlign: 'right' }} />
        </Field>
        <Field label="عدد الأشهر (2–12)">
          <input className="input" type="number" min="2" max="12" value={months} onChange={(e) => setMonths(e.target.value)} dir="ltr" style={{ textAlign: 'right' }} />
        </Field>
      </div>
      <div className="site-grid-2">
        <Field label="بداية التقسيط">
          <input className="input" type="month" value={startPeriod} onChange={(e) => setStartPeriod(e.target.value)} dir="ltr" />
        </Field>
        <Field label="ملاحظات">
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="مثال: تقسيط رسوم الفصل" />
        </Field>
      </div>
      <label className="radio" style={{ margin: '4px 0 8px' }}>
        <input type="checkbox" checked={postFirst} onChange={(e) => setPostFirst(e.target.checked)} />
        <span className="dot" />
        ترحيل القسط الأول كمستحق فوراً (يزيد رصيد الطالب)
      </label>

      {schedule.length > 0 && (
        <div className="ah-table-wrap" style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', maxHeight: 220, overflow: 'auto' }}>
          <table className="table">
            <thead>
              <tr><th>القسط</th><th>الفترة</th><th>المبلغ</th><th>عند الإنشاء</th></tr>
            </thead>
            <tbody>
              {schedule.map((row) => (
                <tr key={row.index}>
                  <td>{row.index}/{schedule.length}</td>
                  <td>{periodLabel(row.period)}</td>
                  <td className="ah-tabnum">{formatILS(row.amountMinorUnits)}</td>
                  <td><span className={`tag tag-${INST_TONE[row.status]}`}>{row.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
