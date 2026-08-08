import { useState } from 'react';
import Modal from '../components/Modal';
import { Field } from '../components/ui';
import { EXPENSE_CATEGORIES } from '../lib/staff';
import { updateExpense, deleteExpense } from '../services/finance';
import { logActivity } from '../services/activity';
import { useAuth } from '../context/AuthContext';

const STATUSES = ['قيد الدفع', 'مدفوع', 'ملغى'];

export default function EditExpenseModal({ expense, onClose, demo }) {
  const { profile } = useAuth();
  const [vendor, setVendor] = useState(expense?.vendor || '');
  const [category, setCategory] = useState(expense?.category || EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState(
    expense?.amountMinorUnits != null ? String(Number(expense.amountMinorUnits) / 100) : '',
  );
  const [status, setStatus] = useState(expense?.status || STATUSES[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    if (demo) { setError('وضع العرض: صِل Firebase لحفظ التعديل.'); return; }
    if (!expense?.id) return;
    setSubmitting(true);
    setError('');
    try {
      await updateExpense(expense.id, {
        vendor: vendor.trim(),
        category,
        amountShekels: amount,
        status,
      });
      await logActivity({
        type: 'expense_updated',
        actorUid: profile?.id,
        actorName: profile?.name,
        actorRole: profile?.role,
        summary: `تعديل مصروف: ${vendor} — ₪ ${amount}`,
        targetType: 'expense',
        targetId: expense.id,
      });
      onClose();
    } catch {
      setError('تعذّر حفظ التعديل.');
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async () => {
    if (demo) { setError('وضع العرض: صِل Firebase للحذف.'); return; }
    if (!expense?.id) return;
    if (!window.confirm(`حذف مصروف «${expense.vendor}»؟`)) return;
    setSubmitting(true);
    setError('');
    try {
      await deleteExpense(expense.id);
      await logActivity({
        type: 'expense_deleted',
        actorUid: profile?.id,
        actorName: profile?.name,
        actorRole: profile?.role,
        summary: `حذف مصروف: ${expense.vendor}`,
        targetType: 'expense',
        targetId: expense.id,
      });
      onClose();
    } catch {
      setError('تعذّر الحذف.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="تعديل المصروف" onClose={onClose} onSubmit={onSubmit} submitLabel="حفظ التعديلات" submitting={submitting} error={error} width={480}>
      <Field label="المورّد / الجهة">
        <input className="input" value={vendor} onChange={(e) => setVendor(e.target.value)} required />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="الفئة">
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            {category && !EXPENSE_CATEGORIES.includes(category) && <option value={category}>{category}</option>}
          </select>
        </Field>
        <Field label="المبلغ (₪)">
          <input className="input" type="number" min="0" dir="ltr" style={{ textAlign: 'right' }} value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </Field>
      </div>
      <Field label="الحالة">
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
          {status && !STATUSES.includes(status) && <option value={status}>{status}</option>}
        </select>
      </Field>
      <button
        type="button"
        className="btn btn-ghost"
        style={{ fontSize: 13, color: 'var(--color-accent-2-700)', alignSelf: 'flex-start' }}
        onClick={onDelete}
        disabled={submitting}
      >
        حذف المصروف
      </button>
    </Modal>
  );
}
