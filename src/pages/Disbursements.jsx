import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { orderBy } from 'firebase/firestore';
import Icon from '../components/Icon';
import BackButton from '../components/BackButton';
import { staffPortalBase } from '../lib/portalPaths';
import { EmptyRow, ErrorBanner, Field, SegmentedTabs } from '../components/ui';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { useLiveOrDemo } from '../hooks/useFirestore';
import { formatILS } from '../lib/constants';
import {
  DISBURSEMENT_KINDS, currentPeriod, normalizeStaff, periodLabel,
} from '../lib/staff';
import { createDisbursement, markDisbursementPaid, updateDisbursement, deleteDisbursement } from '../services/disbursements';

const KIND_TABS = [
  { id: 'all', label: 'الكل' },
  { id: 'advance', label: 'سلف' },
  { id: 'shift', label: 'ورديات' },
  { id: 'consumable', label: 'مستهلكات' },
];

const demoDisbursements = [
  { id: 'd1', kind: 'advance', staffName: 'خالد الأحمد', amountMinorUnits: 20000, status: 'قيد الدفع', note: 'سلفة طارئة', daysAgo: 0 },
  { id: 'd2', kind: 'shift', staffName: 'محمود الطاقة', hours: 8, amountMinorUnits: 20000, status: 'مدفوع', note: 'وردية مولد ليلي', daysAgo: 1 },
  { id: 'd3', kind: 'consumable', vendor: 'سوق النور', amountMinorUnits: 4500, status: 'قيد الدفع', note: 'قرطاسية ومواد تنظيف', daysAgo: 2 },
];

function NewDisbursementModal({ kind, staffList, demo, onClose }) {
  const { profile } = useAuth();
  const [staffId, setStaffId] = useState('');
  const [amount, setAmount] = useState('');
  const [hours, setHours] = useState('8');
  const [rate, setRate] = useState('');
  const [vendor, setVendor] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const period = currentPeriod();
  const kindMeta = DISBURSEMENT_KINDS.find((k) => k.id === kind);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (demo) { setError('صِل Firebase للحفظ الفعلي.'); return; }
    const staff = staffList.find((s) => s.id === staffId);
    setSubmitting(true);
    setError('');
    try {
      await createDisbursement({
        kind,
        amountShekels: amount,
        staffId: staff?.id,
        staffName: staff?.name,
        hours: kind === 'shift' ? hours : undefined,
        rateShekels: kind === 'shift' ? (rate || (staff?.hourlyRateMinorUnits ? staff.hourlyRateMinorUnits / 100 : '')) : undefined,
        vendor: kind === 'consumable' ? vendor : undefined,
        period,
        note,
        actor: { uid: profile?.id, name: profile?.name, role: profile?.role },
      });
      onClose();
    } catch {
      setError('تعذّر التسجيل.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={`تسجيل — ${kindMeta?.label || kind}`} onClose={onClose} onSubmit={onSubmit} submitLabel="حفظ" submitting={submitting} error={error} width={480}>
      <div className="dialog-body">الفترة: {periodLabel(period)}. تظهر للمحاسب والإدارة في نفس السجل.</div>
      {(kind === 'advance' || kind === 'shift') && (
        <Field label="الموظف">
          <select className="input" value={staffId} onChange={(e) => setStaffId(e.target.value)} required>
            <option value="" disabled>اختر…</option>
            {staffList.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.jobTitleAr || s.role}</option>)}
          </select>
        </Field>
      )}
      {kind === 'shift' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="عدد الساعات"><input className="input" type="number" min="0.5" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} required dir="ltr" style={{ textAlign: 'right' }} /></Field>
          <Field label="أجر الساعة (₪)"><input className="input" type="number" min="0" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="أو من ملف الموظف" dir="ltr" style={{ textAlign: 'right' }} /></Field>
        </div>
      )}
      {kind === 'consumable' && (
        <Field label="المورّد / الجهة"><input className="input" value={vendor} onChange={(e) => setVendor(e.target.value)} required /></Field>
      )}
      {kind !== 'shift' && (
        <Field label="المبلغ (₪)"><input className="input" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required dir="ltr" style={{ textAlign: 'right' }} /></Field>
      )}
      <Field label="ملاحظة"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="اختياري" /></Field>
    </Modal>
  );
}

export default function Disbursements() {
  const { pathname } = useLocation();
  const { profile } = useAuth();
  const [filter, setFilter] = useState('all');
  const [newKind, setNewKind] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [demoPaid, setDemoPaid] = useState({});
  const [editing, setEditing] = useState(null);

  const { data: live, demo, error } = useLiveOrDemo('disbursements', [orderBy('createdAt', 'desc')], demoDisbursements);
  const { data: staffRaw } = useLiveOrDemo('staff', [orderBy('name', 'asc')], []);
  const staffList = useMemo(() => staffRaw.map(normalizeStaff).filter((s) => s.active !== false), [staffRaw]);

  const rows = useMemo(() => live.map((r) => (
    demo && demoPaid[r.id] ? { ...r, status: 'مدفوع' } : r
  )).filter((r) => filter === 'all' || r.kind === filter), [live, filter, demo, demoPaid]);

  const onPay = async (row) => {
    setBusyId(row.id);
    try {
      if (demo) setDemoPaid((s) => ({ ...s, [row.id]: true }));
      else await markDisbursementPaid(row.id, { uid: profile?.id, name: profile?.name });
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (row) => {
    if (demo) return;
    if (!window.confirm(`حذف سجل «${kindLabel(row.kind)}»؟`)) return;
    setBusyId(row.id);
    try {
      await deleteDisbursement(row.id);
    } catch {
      window.alert('تعذّر الحذف.');
    } finally {
      setBusyId(null);
    }
  };

  const kindLabel = (k) => DISBURSEMENT_KINDS.find((x) => x.id === k)?.label || k;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <BackButton to={staffPortalBase(pathname)} label="رجوع" />
      <ErrorBanner>{error && 'تعذّر تحميل السجل المالي.'}</ErrorBanner>
      <div className="card" style={{ borderColor: 'var(--color-accent-300)', background: 'var(--color-accent-100)', padding: '14px 16px', fontSize: 13, color: 'var(--color-accent-900)' }}>
        فرز المدفوعات اليومية: <strong>رواتب</strong> (من شاشة الرواتب) · <strong>سلف</strong> · <strong>ورديات</strong> · <strong>مستهلكات</strong>. مناسب لإدارة السيولة في ظروف غير مستقرة.
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <SegmentedTabs tabs={KIND_TABS.map((t) => ({
          ...t, active: filter === t.id, onClick: () => setFilter(t.id),
        }))} />
        <span style={{ marginInlineStart: 'auto' }} />
        <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setNewKind('advance')}>
          <Icon name="request_quote" size={14} /> سلفة
        </button>
        <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setNewKind('shift')}>
          <Icon name="schedule" size={14} /> وردية
        </button>
        <button type="button" className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => setNewKind('consumable')}>
          <Icon name="inventory_2" size={14} /> مستهلكات
        </button>
      </div>

      <div className="card ah-table-wrap" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>النوع</th>
              <th>التفاصيل</th>
              <th>المبلغ</th>
              <th>الحالة</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={5}>لا سجلات في هذه الفئة.</EmptyRow>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td><span className="tag tag-neutral">{kindLabel(r.kind)}</span></td>
                <td>
                  <div style={{ fontWeight: 600 }}>{r.staffName || r.vendor || '—'}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>
                    {r.hours != null ? `${r.hours} ساعة · ` : ''}{r.note || ''}
                  </div>
                </td>
                <td className="ah-tabnum" style={{ color: 'var(--gold)', fontWeight: 600 }}>{formatILS(r.amountMinorUnits)}</td>
                <td><span className={`tag tag-${r.status === 'مدفوع' ? 'accent' : 'outline'}`}>{r.status}</span></td>
                <td style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>
                  <button type="button" className="btn btn-ghost" style={{ fontSize: 11 }} disabled={demo || busyId === r.id} onClick={() => setEditing(r)}>
                    تعديل
                  </button>
                  {r.status === 'قيد الدفع' && (
                    <button type="button" className="btn btn-primary" style={{ fontSize: 11, padding: '4px 10px' }} disabled={busyId === r.id} onClick={() => onPay(r)}>
                      تأكيد الدفع
                    </button>
                  )}
                  <button type="button" className="btn btn-ghost" style={{ fontSize: 11, color: 'var(--color-accent-2-700)' }} disabled={demo || busyId === r.id} onClick={() => onDelete(r)}>
                    حذف
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {newKind && (
        <NewDisbursementModal
          kind={newKind}
          staffList={staffList}
          demo={demo}
          onClose={() => setNewKind(null)}
        />
      )}
      {editing && (
        <EditDisbursementModal
          row={editing}
          demo={demo}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function EditDisbursementModal({ row, demo, onClose }) {
  const [amount, setAmount] = useState(
    row?.amountMinorUnits != null ? String(Number(row.amountMinorUnits) / 100) : '',
  );
  const [note, setNote] = useState(row?.note || '');
  const [vendor, setVendor] = useState(row?.vendor || '');
  const [staffName, setStaffName] = useState(row?.staffName || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    if (demo) { setError('صِل Firebase للحفظ.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await updateDisbursement(row.id, {
        amountShekels: amount,
        note,
        vendor: row.kind === 'consumable' ? vendor : undefined,
        staffName: row.kind !== 'consumable' ? staffName : undefined,
      });
      onClose();
    } catch {
      setError('تعذّر الحفظ.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="تعديل السجل" onClose={onClose} onSubmit={onSubmit} submitLabel="حفظ" submitting={submitting} error={error} width={440}>
      {row.kind === 'consumable' ? (
        <Field label="المورّد"><input className="input" value={vendor} onChange={(e) => setVendor(e.target.value)} /></Field>
      ) : (
        <Field label="الموظف"><input className="input" value={staffName} onChange={(e) => setStaffName(e.target.value)} /></Field>
      )}
      <Field label="المبلغ (₪)">
        <input className="input" type="number" min="0" dir="ltr" style={{ textAlign: 'right' }} value={amount} onChange={(e) => setAmount(e.target.value)} required />
      </Field>
      <Field label="ملاحظة"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
    </Modal>
  );
}
