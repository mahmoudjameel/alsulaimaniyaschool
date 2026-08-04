import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { orderBy, where } from 'firebase/firestore';
import ChildSwitcher from '../../components/ChildSwitcher';
import Icon from '../../components/Icon';
import { EmptyRow, ErrorBanner } from '../../components/ui';
import { useMyChildren } from '../../hooks/useMyChildren';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { formatILS } from '../../lib/constants';
import { relativeDaysAr, relativeFromTimestamp } from '../../lib/relativeTime';
import { demoBilling, demoPaymentProofs, demoStudentDetail } from '../../data/demo';
import SubmitPaymentModal from '../../modals/SubmitPaymentModal';

const STATUS_TONE = { 'قيد المراجعة': 'outline', 'معتمد': 'accent', 'مرفوض': 'accent2' };

function ChildCharges({ childId, demo }) {
  const { data: chargesRaw } = useLiveOrDemo(
    'charges',
    [where('studentId', '==', childId || '__none__')],
    (demoBilling?.charges || []).filter((c) => c.studentId === childId || c.student === 'يوسف الأحمد'),
    childId || '__none__',
  );
  const charges = useMemo(() => {
    const list = [...(chargesRaw || [])];
    list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    return list;
  }, [chargesRaw]);

  if (!charges.length) return null;

  return (
    <div style={{ marginTop: 12 }}>
      <div className="card-kicker" style={{ marginBottom: 6 }}>الفواتير</div>
      <div className="ah-table-wrap">
        <table className="table">
          <thead><tr><th>النوع</th><th>المبلغ</th><th>الحالة</th></tr></thead>
          <tbody>
            {charges.map((c) => (
              <tr key={c.id}>
                <td>{c.type || '—'}</td>
                <td className="ah-tabnum">{c.amount || formatILS(c.amountMinorUnits)}</td>
                <td><span className="tag tag-outline">{c.status || '—'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChildLedger({ childId }) {
  const demoLedger = demoStudentDetail[childId]?.ledger || demoStudentDetail.s1?.ledger || [];
  const { data: ledger } = useLiveOrDemo(
    `students/${childId}/ledger`,
    [orderBy('date', 'desc')],
    demoLedger,
    childId,
  );

  if (!ledger?.length) return null;

  return (
    <div style={{ marginTop: 12 }}>
      <div className="card-kicker" style={{ marginBottom: 6 }}>كشف الحساب</div>
      <div className="ah-table-wrap">
        <table className="table">
          <thead><tr><th>التاريخ</th><th>البند</th><th>المبلغ</th></tr></thead>
          <tbody>
            {ledger.map((l, j) => (
              <tr key={l.id || j}>
                <td className="ah-tabnum" style={{ color: 'var(--color-neutral-500)' }}>{l.date}</td>
                <td>{l.item}</td>
                <td className="ah-tabnum" style={{ color: l.creditMinorUnits ? 'var(--color-accent-700)' : undefined }}>
                  {l.debitMinorUnits
                    ? formatILS(l.debitMinorUnits)
                    : `− ${formatILS(l.creditMinorUnits)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ParentFees() {
  const { profile, children, demo, error } = useMyChildren();
  const { data: liveProofs } = useLiveOrDemo(
    'paymentProofs',
    [where('guardianUid', '==', profile?.id || '__none__')],
    demoPaymentProofs.filter((p) => p.studentId === 's1' || p.studentId === 's8'),
    profile?.id,
  );

  const [selectedId, setSelectedId] = useState(children[0]?.id || '');
  const [payingChild, setPayingChild] = useState(null);
  const [demoProofs, setDemoProofs] = useState([]);

  useEffect(() => {
    if (children.length && !children.some((c) => c.id === selectedId)) {
      setSelectedId(children[0].id);
    }
  }, [children, selectedId]);

  const activeId = selectedId || children[0]?.id;
  const activeChild = children.find((c) => c.id === activeId) || children[0];

  const proofs = useMemo(() => {
    const base = demo ? [...demoProofs, ...(liveProofs || [])] : (liveProofs || []);
    const seen = new Set();
    return base.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [demo, demoProofs, liveProofs]);

  const dueFor = (c) => c?.due ?? c?.balanceMinorUnits ?? c?.dueMinorUnits ?? 0;
  const proofsFor = (studentId) => proofs.filter((p) => p.studentId === studentId);
  const pendingAmount = (studentId) => proofsFor(studentId)
    .filter((p) => p.status === 'قيد المراجعة')
    .reduce((sum, p) => sum + (p.amountMinorUnits || 0), 0);

  return (
    <div className="stu-page">
      <ErrorBanner>{error && 'تعذّر تحميل بيانات الرسوم.'}</ErrorBanner>
      <header className="stu-page-head">
        <h1 className="stu-page-title">الرسوم والدفعات</h1>
        <p className="stu-page-lead">حوّل بنكيًا ثم أرفق صورة الوصل — يُخصم الرصيد بعد اعتماد الإدارة.</p>
      </header>

      <ChildSwitcher children={children} selectedId={activeId} onChange={setSelectedId} />

      <div className="card" style={{ borderColor: 'var(--color-accent-300)', background: 'var(--color-accent-100)', padding: '14px 16px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: 'var(--color-accent-900)' }}>
          <Icon name="account_balance" size={18} color="var(--color-accent-800)" style={{ marginTop: 2 }} />
          <div>
            ادفع عبر <strong>تحويل بنكي</strong> ثم أرفق صورة الوصل. يبقى المبلغ مستحقاً حتى تعتمد الإدارة الوصل.
          </div>
        </div>
      </div>

      {children.length === 0 && (
        <div className="card stu-empty-card">
          <Icon name="payments" size={28} color="var(--gold)" />
          <p>لا أبناء مرتبطون لعرض الرسوم.</p>
        </div>
      )}

      {activeChild && (() => {
        const due = dueFor(activeChild);
        const pending = pendingAmount(activeChild.id);
        const childProofs = proofsFor(activeChild.id);
        return (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div className="card-title">{activeChild.name}</div>
                <div className="stu-class-meta">{activeChild.grade}</div>
              </div>
              <div style={{ textAlign: 'start' }}>
                <div className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 22, color: due > 0 ? 'var(--gold)' : 'var(--color-accent-700)' }}>
                  {formatILS(due)}
                </div>
                <div className="stu-class-meta">المستحق</div>
              </div>
            </div>

            {pending > 0 && (
              <div className="stu-class-meta" style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="hourglass_top" size={14} />
                وصل قيد المراجعة بمبلغ {formatILS(pending)}
              </div>
            )}

            <ChildCharges childId={activeChild.id} demo={demo} />
            <ChildLedger childId={activeChild.id} />

            {childProofs.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div className="card-kicker" style={{ marginBottom: 6 }}>وصول الدفع</div>
                <div className="ah-table-wrap">
                  <table className="table">
                    <thead><tr><th>المبلغ</th><th>المحوّل</th><th>الحالة</th><th>التاريخ</th></tr></thead>
                    <tbody>
                      {childProofs.map((p) => (
                        <tr key={p.id}>
                          <td className="ah-tabnum">{formatILS(p.amountMinorUnits)}</td>
                          <td>
                            <div>{p.payerName}</div>
                            {p.rejectionReason && p.status === 'مرفوض' && (
                              <div style={{ fontSize: 11, color: 'var(--color-accent-2-700)' }}>{p.rejectionReason}</div>
                            )}
                          </td>
                          <td><span className={`tag tag-${STATUS_TONE[p.status] || 'neutral'}`}>{p.status}</span></td>
                          <td className="ah-tabnum" style={{ color: 'var(--color-neutral-500)' }}>
                            {demo && p.daysAgo != null ? relativeDaysAr(p.daysAgo) : relativeFromTimestamp(p.createdAt)}
                          </td>
                        </tr>
                      ))}
                      {childProofs.length === 0 && <EmptyRow colSpan={4}>لا توجد وصول بعد.</EmptyRow>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <button
              type="button"
              className="btn btn-primary btn-block"
              style={{ marginTop: 14 }}
              disabled={due <= 0}
              onClick={() => setPayingChild(activeChild)}
            >
              <Icon name="upload_file" size={15} />
              {due > 0 ? `إرفاق وصل دفع — حتى ${formatILS(due)}` : 'لا يوجد مستحقات'}
            </button>
          </div>
        );
      })()}

      {children.length > 1 && (
        <p className="stu-class-meta">
          إجمالي مستحق كل الأبناء: {formatILS(children.reduce((s, c) => s + dueFor(c), 0))}
          {' · '}
          <Link to="/parent/inbox">التنبيهات</Link>
        </p>
      )}

      {payingChild && (
        <SubmitPaymentModal
          child={payingChild}
          dueMinorUnits={dueFor(payingChild)}
          profile={profile}
          demo={demo}
          onClose={() => setPayingChild(null)}
          onDemoSubmit={(proof) => setDemoProofs((list) => [proof, ...list])}
        />
      )}
    </div>
  );
}
