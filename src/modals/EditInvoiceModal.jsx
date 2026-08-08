import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/Modal';
import { Field } from '../components/ui';
import { formatILS, shekelsToMinorUnits } from '../lib/constants';
import { deleteCharge, updateCharge } from '../services/finance';
import { logActivity } from '../services/activity';
import { useAuth } from '../context/AuthContext';
import { useAcademicStages } from '../hooks/useAcademicStages';
import {
  FEE_TYPE_OPTIONS,
  SEAT_RESERVATION_TYPE,
  isSeatReservationType,
  resolveSeatFeeMinorUnits,
} from '../lib/feeTypes';

const METHODS = ['نقد', 'تحويل', 'شيك', 'يدوي', 'تقسيط', '—'];
const STATUSES = ['مسودّة', 'قيد التأكيد', 'مؤكَّد', 'متأخّر'];

export default function EditInvoiceModal({ charge, onClose, demo, stages: stagesProp }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { stages: stagesHook } = useAcademicStages();
  const stages = stagesProp || stagesHook;
  const [type, setType] = useState(charge?.type || FEE_TYPE_OPTIONS[0]);
  const [amount, setAmount] = useState(
    charge?.amountMinorUnits != null ? String(Number(charge.amountMinorUnits) / 100) : '',
  );
  const [discount, setDiscount] = useState(
    charge?.discountMinorUnits != null ? String(Number(charge.discountMinorUnits) / 100) : '0',
  );
  const [method, setMethod] = useState(charge?.method || METHODS[0]);
  const [status, setStatus] = useState(charge?.status || STATUSES[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isSeatReservationType(type)) return;
    const studentLike = {
      stageId: charge?.stageId,
      stageLabel: charge?.stageLabel,
      grade: charge?.grade,
    };
    const seat = resolveSeatFeeMinorUnits(studentLike, stages);
    if (seat > 0 && !charge?.amountMinorUnits) {
      setAmount(String(seat / 100));
    }
  }, [type, charge, stages]);

  const onTypeChange = (next) => {
    setType(next);
    if (isSeatReservationType(next)) {
      const seat = resolveSeatFeeMinorUnits({
        stageId: charge?.stageId,
        stageLabel: charge?.stageLabel,
        grade: charge?.grade,
      }, stages);
      if (seat > 0) setAmount(String(seat / 100));
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (demo) { setError('وضع العرض: صِل Firebase لحفظ التعديل.'); return; }
    if (!charge?.id) return;
    const amountMinorUnits = shekelsToMinorUnits(amount);
    const discountMinorUnits = shekelsToMinorUnits(discount);
    if (amountMinorUnits < 0) { setError('المبلغ غير صالح.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await updateCharge(charge.id, {
        type,
        method,
        status,
        amountMinorUnits,
        discountMinorUnits,
      });
      await logActivity({
        type: 'charge_updated',
        actorUid: profile?.id,
        actorName: profile?.name,
        actorRole: profile?.role,
        summary: `تعديل فاتورة ${charge.student || ''} — ${type} · ${formatILS(amountMinorUnits)}`,
        targetType: 'charge',
        targetId: charge.id,
      });
      onClose();
      if (isSeatReservationType(type)) {
        const path = window.location.pathname.includes('/accountant')
          ? '/accountant/seat-reservations'
          : '/admin/seat-reservations';
        navigate(path);
      }
    } catch {
      setError('تعذّر حفظ التعديل.');
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async () => {
    if (demo) { setError('وضع العرض: صِل Firebase للحذف.'); return; }
    if (!charge?.id) return;
    if (!window.confirm(`حذف فاتورة «${charge.type}» للطالب ${charge.student}؟ سيُعدَّل رصيد الطالب.`)) return;
    setSubmitting(true);
    setError('');
    try {
      await deleteCharge(charge.id);
      await logActivity({
        type: 'charge_deleted',
        actorUid: profile?.id,
        actorName: profile?.name,
        actorRole: profile?.role,
        summary: `حذف فاتورة ${charge.student || ''} — ${charge.type}`,
        targetType: 'charge',
        targetId: charge.id,
      });
      onClose();
    } catch {
      setError('تعذّر حذف الفاتورة.');
    } finally {
      setSubmitting(false);
    }
  };

  const seatHint = resolveSeatFeeMinorUnits({
    stageId: charge?.stageId,
    stageLabel: charge?.stageLabel,
    grade: charge?.grade,
  }, stages);

  return (
    <Modal title="تعديل الفاتورة" onClose={onClose} onSubmit={onSubmit} submitLabel="حفظ التعديلات" submitting={submitting} error={error} width={480}>
      <div className="dialog-body">
        الطالب: <strong>{charge?.student || '—'}</strong>
        {charge?.grade || charge?.stageLabel ? ` · ${charge.grade || charge.stageLabel}` : ''}
        {(charge?.periodLabel || charge?.period) ? (
          <>
            <br />
            الشهر: <strong>{charge.periodLabel || charge.period}</strong>
          </>
        ) : null}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="نوع الرسم">
          <select className="input" value={type} onChange={(e) => onTypeChange(e.target.value)}>
            {FEE_TYPE_OPTIONS.map((t) => <option key={t}>{t}</option>)}
            {type && !FEE_TYPE_OPTIONS.includes(type) && <option value={type}>{type}</option>}
          </select>
        </Field>
        <Field label="الحالة">
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
            {status && !STATUSES.includes(status) && <option value={status}>{status}</option>}
          </select>
        </Field>
      </div>
      {isSeatReservationType(type) && (
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.7,
            padding: 10,
            borderRadius: 8,
            background: 'var(--color-accent-100)',
            border: '1px solid var(--color-accent-300)',
          }}
        >
          <strong>{SEAT_RESERVATION_TYPE}</strong> — رسم لمرة واحدة حسب المرحلة
          {seatHint > 0 ? <> (المعرّف للمرحلة: <span className="ah-tabnum">{formatILS(seatHint)}</span>)</> : null}.
          {' '}بعد الحفظ تُفتح صفحة سجل حجز المقعد مع العدّاد.
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="المبلغ (₪)">
          <input className="input" type="number" min="0" step="0.01" dir="ltr" style={{ textAlign: 'right' }} value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </Field>
        <Field label="الخصم/المنحة (₪)">
          <input className="input" type="number" min="0" step="0.01" dir="ltr" style={{ textAlign: 'right' }} value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </Field>
      </div>
      <Field label="طريقة الدفع">
        <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
          {METHODS.map((m) => <option key={m}>{m}</option>)}
          {method && !METHODS.includes(method) && <option value={method}>{method}</option>}
        </select>
      </Field>
      <button
        type="button"
        className="btn btn-ghost"
        style={{ fontSize: 13, color: 'var(--color-accent-2-700)', alignSelf: 'flex-start' }}
        onClick={onDelete}
        disabled={submitting}
      >
        حذف الفاتورة
      </button>
    </Modal>
  );
}
