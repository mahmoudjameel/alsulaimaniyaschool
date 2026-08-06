import { useMemo } from 'react';
import { where } from 'firebase/firestore';
import { EmptyRow } from './ui';
import { useLiveOrDemo } from '../hooks/useFirestore';
import { useAcademicYearLabel } from './AcademicYearText';
import { formatILS } from '../lib/constants';
import { filterByAcademicYear } from '../services/grades';
import { demoInstallmentPlans, demoInstallments, demoStudentDiscounts } from '../data/demo';

/** Read-only discounts + installment schedule for parent/student fee screens. */
export default function StudentFeeAidPanel({ studentId, demo, framed = false }) {
  const { academicYear } = useAcademicYearLabel();

  const { data: discountsRaw } = useLiveOrDemo(
    'studentDiscounts',
    [where('studentId', '==', studentId || '__none__')],
    demoStudentDiscounts.filter((d) => d.studentId === studentId),
    studentId || '__none__',
  );
  const { data: plansRaw } = useLiveOrDemo(
    'installmentPlans',
    [where('studentId', '==', studentId || '__none__')],
    demoInstallmentPlans.filter((p) => p.studentId === studentId),
    studentId || '__none__',
  );
  const { data: installmentsRaw } = useLiveOrDemo(
    'installments',
    [where('studentId', '==', studentId || '__none__')],
    demoInstallments.filter((i) => i.studentId === studentId),
    studentId || '__none__',
  );

  const discounts = useMemo(
    () => filterByAcademicYear((discountsRaw || []).filter((d) => d.status !== 'ملغى'), academicYear),
    [discountsRaw, academicYear],
  );
  const plans = useMemo(
    () => filterByAcademicYear((plansRaw || []).filter((p) => p.status !== 'ملغى'), academicYear),
    [plansRaw, academicYear],
  );
  const installments = useMemo(() => {
    const planIds = new Set(plans.map((p) => p.id));
    return (installmentsRaw || [])
      .filter((i) => !i.planId || planIds.has(i.planId) || !plans.length)
      .sort((a, b) => String(a.period || '').localeCompare(String(b.period || '')));
  }, [installmentsRaw, plans]);

  if (!studentId) return null;
  if (!discounts.length && !plans.length) return null;

  return (
    <div className={framed ? 'card' : undefined} style={{ marginTop: framed ? 0 : 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {discounts.length > 0 && (
        <div>
          <div className="card-kicker" style={{ marginBottom: 6 }}>خصم / إعفاء / منحة</div>
          <div className="ah-table-wrap">
            <table className="table">
              <thead>
                <tr><th>النوع</th><th>المبلغ</th><th>السبب</th><th>الحالة</th></tr>
              </thead>
              <tbody>
                {discounts.map((d) => (
                  <tr key={d.id}>
                    <td>{d.kindLabel || d.kind || 'خصم'}</td>
                    <td className="ah-tabnum">
                      {d.mode === 'percent' && d.percent != null
                        ? `${d.percent}%`
                        : formatILS(d.amountMinorUnits)}
                    </td>
                    <td style={{ fontSize: 12 }}>{d.reason || d.notes || '—'}</td>
                    <td><span className="tag tag-accent">{d.status || 'مفعّل'}</span></td>
                  </tr>
                ))}
                {discounts.length === 0 && <EmptyRow colSpan={4}>—</EmptyRow>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {plans.length > 0 && (
        <div>
          <div className="card-kicker" style={{ marginBottom: 6 }}>خطة التقسيط</div>
          {plans.map((plan) => {
            const rows = installments.filter((i) => i.planId === plan.id);
            return (
              <div key={plan.id} style={{ marginBottom: 10 }}>
                <div className="stu-class-meta" style={{ marginBottom: 6 }}>
                  إجمالي {formatILS(plan.totalMinorUnits)}
                  {plan.months ? ` · ${plan.months} أقساط` : ''}
                  {plan.notes ? ` · ${plan.notes}` : ''}
                  {' · '}
                  <span className="tag tag-outline">{plan.status || 'نشط'}</span>
                </div>
                <div className="ah-table-wrap">
                  <table className="table">
                    <thead>
                      <tr><th>القسط</th><th>الشهر</th><th>المبلغ</th><th>الحالة</th></tr>
                    </thead>
                    <tbody>
                      {(rows.length ? rows : []).map((i) => (
                        <tr key={i.id}>
                          <td className="ah-tabnum">{i.index}/{i.ofTotal || plan.months || '—'}</td>
                          <td>{i.period || '—'}</td>
                          <td className="ah-tabnum">{formatILS(i.amountMinorUnits)}</td>
                          <td><span className="tag tag-outline">{i.status || '—'}</span></td>
                        </tr>
                      ))}
                      {rows.length === 0 && (
                        <EmptyRow colSpan={4}>
                          قسط تقريبي {formatILS(plan.installmentMinorUnits)} × {plan.months || '—'}
                        </EmptyRow>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
          {demo && <p className="stu-class-meta">عرض توضيحي للخصم والتقسيط.</p>}
        </div>
      )}
    </div>
  );
}
