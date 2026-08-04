import { useState } from 'react';
import Modal from '../components/Modal';
import { Field } from '../components/ui';
import { EXPENSE_CATEGORIES } from '../lib/staff';
import { createExpense } from '../services/finance';
import { logActivity } from '../services/activity';
import { useAuth } from '../context/AuthContext';

export default function NewExpenseModal({ onClose, demo }) {
  const { profile } = useAuth();
  const [vendor, setVendor] = useState('');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    if (demo) { setError('وضع العرض التوضيحي: صِل مشروع Firebase لحفظ المصاريف فعلياً.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const expenseId = await createExpense({ vendor, category, amountShekels: amount });
      await logActivity({
        type: 'expense_created', actorUid: profile?.id, actorName: profile?.name, actorRole: profile?.role,
        summary: `تسجيل مصروف: ${vendor} (${category}) — ₪ ${amount}`, targetType: 'expense', targetId: expenseId,
      });
      onClose();
    } catch {
      setError('تعذّر حفظ المصروف. حاول مجدداً.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="تسجيل مصروف" onClose={onClose} onSubmit={onSubmit} submitLabel="حفظ المصروف" submitting={submitting} error={error} width={480}>
      <div className="dialog-body">كهرباء، ماء، مستهلكات، طوارئ… يُضاف بحالة «قيد الدفع».</div>
      <Field label="المورّد / الجهة"><input className="input" placeholder="مثال: شركة الكهرباء / سوق محلي" value={vendor} onChange={(e) => setVendor(e.target.value)} required /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="الفئة">
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="المبلغ (₪)"><input className="input" type="number" min="0" placeholder="0" dir="ltr" style={{ textAlign: 'right' }} value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
      </div>
    </Modal>
  );
}
