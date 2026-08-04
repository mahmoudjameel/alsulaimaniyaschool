import { useMemo, useState } from 'react';
import Modal from '../components/Modal';
import SearchInput from '../components/SearchInput';
import { Field } from '../components/ui';
import { createManualCharge } from '../services/finance';
import { filterByStudentSearch } from '../lib/studentSearch';

const FEE_TYPES = ['رسوم دراسية', 'مواصلات', 'زيّ مدرسي', 'كتب ومستلزمات', 'رسوم نشاط', 'أخرى'];
const METHODS = ['نقد', 'تحويل', 'شيك'];

export default function NewInvoiceModal({ students, onClose, demo }) {
  const [studentId, setStudentId] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState(FEE_TYPES[0]);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState(METHODS[0]);
  const [receiptFile, setReceiptFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const options = useMemo(() => filterByStudentSearch(students, search), [students, search]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (demo) { setError('وضع العرض التوضيحي: صِل مشروع Firebase لرفع الفواتير فعلياً.'); return; }
    const student = students.find((s) => s.id === studentId);
    if (!student) { setError('اختر طالباً.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await createManualCharge({ studentId, studentName: student.name, type, amountShekels: amount, method, receiptFile });
      onClose();
    } catch {
      setError('تعذّر حفظ الفاتورة. حاول مجدداً.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="رفع فاتورة جديدة" onClose={onClose} onSubmit={onSubmit} submitLabel="حفظ الفاتورة" submitting={submitting} error={error} width={480}>
      <div className="dialog-body">تُضاف الفاتورة لدفتر حساب الطالب فوراً ويُحدَّث رصيده المستحق تلقائياً.</div>
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="بحث سريع بالاسم أو الهوية…"
        style={{ maxWidth: '100%', marginBottom: 8 }}
      />
      <Field label={`الطالب${search.trim() ? ` (${options.length})` : ''}`}>
        <select className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
          <option value="" disabled>اختر طالباً…</option>
          {options.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {s.displayId}{s.nationalId ? ` · ${s.nationalId}` : ''}
            </option>
          ))}
        </select>
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="نوع الرسم">
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {FEE_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="المبلغ (₪)"><input className="input" type="number" min="0" step="0.01" placeholder="0" dir="ltr" style={{ textAlign: 'right' }} value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
      </div>
      <Field label="طريقة الدفع">
        <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
          {METHODS.map((m) => <option key={m}>{m}</option>)}
        </select>
      </Field>
      <Field label="إيصال الدفعة (اختياري)">
        <input className="input" type="file" accept="image/*,.pdf" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} />
      </Field>
    </Modal>
  );
}
