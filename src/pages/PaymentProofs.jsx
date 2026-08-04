import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { orderBy } from 'firebase/firestore';
import Icon from '../components/Icon';
import BackButton from '../components/BackButton';
import { EmptyRow, ErrorBanner, SegmentedTabs } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useLiveOrDemo } from '../hooks/useFirestore';
import { demoPaymentProofs } from '../data/demo';
import { formatILS } from '../lib/constants';
import { relativeDaysAr, relativeFromTimestamp } from '../lib/relativeTime';
import { approvePaymentProof, rejectPaymentProof } from '../services/finance';

const TABS = [
  { id: 'قيد المراجعة', label: 'قيد المراجعة' },
  { id: 'معتمد', label: 'معتمد' },
  { id: 'مرفوض', label: 'مرفوض' },
];

const STATUS_TONE = { 'قيد المراجعة': 'outline', 'معتمد': 'accent', 'مرفوض': 'accent2' };

export default function PaymentProofs() {
  const { pathname } = useLocation();
  const { profile } = useAuth();
  const [filter, setFilter] = useState('قيد المراجعة');
  const [demoOverrides, setDemoOverrides] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [message, setMessage] = useState('');

  const { data, demo, error } = useLiveOrDemo('paymentProofs', [orderBy('createdAt', 'desc')], demoPaymentProofs);

  const rows = useMemo(() => data.map((r) => (
    demo && demoOverrides[r.id] ? { ...r, ...demoOverrides[r.id] } : r
  )), [data, demo, demoOverrides]);

  const counts = useMemo(() => ({
    'قيد المراجعة': rows.filter((r) => r.status === 'قيد المراجعة').length,
    'معتمد': rows.filter((r) => r.status === 'معتمد').length,
    'مرفوض': rows.filter((r) => r.status === 'مرفوض').length,
  }), [rows]);

  const view = rows.filter((r) => r.status === filter);

  const actor = { uid: profile?.id, name: profile?.name, role: profile?.role };

  const onApprove = async (row) => {
    setBusyId(row.id);
    setMessage('');
    try {
      if (demo) {
        setDemoOverrides((s) => ({
          ...s,
          [row.id]: { status: 'معتمد', reviewedByName: profile?.name || 'المراجع', rejectionReason: null },
        }));
        setMessage(`تم اعتماد دفعة ${formatILS(row.amountMinorUnits)} لـ ${row.studentName} (عرض توضيحي).`);
      } else {
        await approvePaymentProof(row.id, actor);
        setMessage(`تم اعتماد الدفعة وخصم ${formatILS(row.amountMinorUnits)} من رصيد ${row.studentName}.`);
      }
    } catch {
      setMessage('تعذّر اعتماد الوصل.');
    } finally {
      setBusyId(null);
    }
  };

  const onRejectConfirm = async (row) => {
    setBusyId(row.id);
    setMessage('');
    try {
      if (demo) {
        setDemoOverrides((s) => ({
          ...s,
          [row.id]: { status: 'مرفوض', reviewedByName: profile?.name || 'المراجع', rejectionReason: rejectReason || 'لم يُقبل الوصل' },
        }));
        setMessage('تم رفض الوصل (عرض توضيحي).');
      } else {
        await rejectPaymentProof(row.id, actor, rejectReason);
        setMessage('تم رفض الوصل وإبلاغ ولي الأمر عبر تحديث الحالة.');
      }
      setRejectingId(null);
      setRejectReason('');
    } catch {
      setMessage('تعذّر رفض الوصل.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <BackButton to={pathname.startsWith('/accountant') ? '/accountant/invoices' : '/admin/billing'} label="عودة للفواتير" />
      <ErrorBanner>{error && 'تعذّر تحميل وصول الدفع. تحقق من الصلاحيات أو الاتصال.'}</ErrorBanner>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <SegmentedTabs tabs={TABS.map((t) => ({
          ...t,
          label: `${t.label} · ${counts[t.id]}`,
          active: filter === t.id,
          onClick: () => setFilter(t.id),
        }))} />
        <span style={{ marginInlineStart: 'auto' }} />
        <span className="tag tag-neutral">تحويل بنكي بإرفاق وصل</span>
      </div>
      {message && <div style={{ fontSize: 13, color: 'var(--color-accent-700)' }}>{message}</div>}

      <div className="card ah-table-wrap" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>الطالب</th>
              <th>ولي الأمر</th>
              <th>المبلغ</th>
              <th>الحساب / المحوّل</th>
              <th>الهاتف</th>
              <th>الوصل</th>
              <th>التاريخ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {view.length === 0 && <EmptyRow colSpan={8}>لا توجد وصول في هذه الفئة حالياً.</EmptyRow>}
            {view.map((r) => (
              <tr key={r.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{r.studentName}</div>
                  {r.transferRef && <div className="ah-tabnum" style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>#{r.transferRef}</div>}
                </td>
                <td>{r.guardianName || '—'}</td>
                <td className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', color: 'var(--gold)' }}>{formatILS(r.amountMinorUnits)}</td>
                <td>
                  <div style={{ fontSize: 13 }}>{r.bankAccountName}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>{r.payerName}</div>
                </td>
                <td className="ah-tabnum" dir="ltr" style={{ textAlign: 'right' }}>{r.payerPhone}</td>
                <td>
                  {r.receiptUrl
                    ? <a href={r.receiptUrl} target="_blank" rel="noreferrer" className="ah-tablink" style={{ color: 'var(--gold)' }}>عرض</a>
                    : <span style={{ color: 'var(--color-neutral-500)', fontSize: 12 }}>—</span>}
                </td>
                <td className="ah-tabnum" style={{ color: 'var(--color-neutral-500)' }}>
                  {demo ? relativeDaysAr(r.daysAgo) : relativeFromTimestamp(r.createdAt)}
                </td>
                <td style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>
                  {r.status === 'قيد المراجعة' ? (
                    rejectingId === r.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 180 }}>
                        <input
                          className="input"
                          style={{ fontSize: 12, padding: '4px 8px' }}
                          placeholder="سبب الرفض…"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                        />
                        <div>
                          <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} disabled={busyId === r.id} onClick={() => onRejectConfirm(r)}>تأكيد الرفض</button>{' '}
                          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setRejectingId(null); setRejectReason(''); }}>إلغاء</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: 12 }} disabled={busyId === r.id} onClick={() => onApprove(r)}>
                          <Icon name="task_alt" size={13} /> اعتماد
                        </button>{' '}
                        <button className="btn btn-ghost" style={{ fontSize: 12 }} disabled={busyId === r.id} onClick={() => setRejectingId(r.id)}>رفض</button>
                      </>
                    )
                  ) : (
                    <span className={`tag tag-${STATUS_TONE[r.status] || 'neutral'}`}>{r.status}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {view.some((r) => r.status === 'مرفوض' && r.rejectionReason) && filter === 'مرفوض' && (
        <div className="card" style={{ borderStyle: 'dashed' }}>
          <div className="card-kicker" style={{ marginBottom: 8 }}>أسباب الرفض</div>
          {view.filter((r) => r.rejectionReason).map((r) => (
            <div key={r.id} style={{ fontSize: 13, marginBottom: 6 }}>
              <strong>{r.studentName}:</strong> {r.rejectionReason}
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ borderColor: 'var(--color-accent-300)', background: 'var(--color-accent-100)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Icon name="info" size={18} color="var(--color-accent-800)" style={{ marginTop: 2 }} />
          <div style={{ fontSize: 13, color: 'var(--color-accent-900)' }}>
            عند <strong>الاعتماد</strong> يُخصم المبلغ من رصيد الطالب المستحق ويُسجَّل في دفتر الحساب كدفعة تحويل بنكي، ويظهر لولي الأمر بحالة «معتمد». الرفض لا يغيّر الرصيد.
          </div>
        </div>
      </div>
    </div>
  );
}
