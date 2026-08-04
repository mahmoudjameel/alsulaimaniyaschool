import { useEffect, useState } from 'react';
import Modal from '../components/Modal';
import { Field } from '../components/ui';
import { formatILS, shekelsToMinorUnits } from '../lib/constants';
import { submitPaymentProof } from '../services/finance';

const MAX_FILE_BYTES = 8 * 1024 * 1024;

export default function SubmitPaymentModal({ child, dueMinorUnits, profile, demo, onClose, onDemoSubmit }) {
  const maxShekels = (dueMinorUnits || 0) / 100;
  const [amount, setAmount] = useState(maxShekels > 0 ? String(maxShekels) : '');
  const [bankAccountName, setBankAccountName] = useState('مدرسة السليمانية — بنك فلسطين');
  const [payerName, setPayerName] = useState(profile?.name || '');
  const [payerPhone, setPayerPhone] = useState(profile?.phone || '');
  const [transferRef, setTransferRef] = useState('');
  const [note, setNote] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!receiptFile || !receiptFile.type.startsWith('image/')) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(receiptFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [receiptFile]);

  const onFile = (e) => {
    const file = e.target.files?.[0] || null;
    if (!file) { setReceiptFile(null); return; }
    if (file.size > MAX_FILE_BYTES) {
      setError('حجم الملف يتجاوز 8 ميغابايت.');
      setReceiptFile(null);
      return;
    }
    setError('');
    setReceiptFile(file);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const amountMinor = shekelsToMinorUnits(amount);
    if (!receiptFile) { setError('أرفق صورة وصل التحويل أو ملف PDF.'); return; }
    if (!amountMinor || amountMinor <= 0) { setError('أدخل مبلغاً صحيحاً.'); return; }
    if (amountMinor > dueMinorUnits) { setError(`المبلغ يتجاوز المستحق (${formatILS(dueMinorUnits)}).`); return; }
    if (!payerName.trim() || !payerPhone.trim() || !bankAccountName.trim()) {
      setError('أكمِل اسم المحوّل ورقم الهاتف واسم الحساب البنكي.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      if (demo) {
        onDemoSubmit?.({
          id: `demo-pp-${Date.now()}`,
          studentId: child.id,
          studentName: child.name,
          guardianUid: profile?.id || 'parent-demo',
          guardianName: profile?.name || 'ولي الأمر',
          amountMinorUnits: amountMinor,
          bankAccountName: bankAccountName.trim(),
          payerName: payerName.trim(),
          payerPhone: payerPhone.trim(),
          transferRef: transferRef.trim() || null,
          note: note.trim() || null,
          receiptUrl: previewUrl,
          status: 'قيد المراجعة',
          daysAgo: 0,
        });
        onClose();
        return;
      }
      await submitPaymentProof({
        studentId: child.id,
        studentName: child.name,
        guardianUid: profile.id,
        guardianName: profile.name,
        amountShekels: amount,
        bankAccountName,
        payerName,
        payerPhone,
        transferRef,
        note,
        receiptFile,
        actor: { uid: profile.id, name: profile.name },
      });
      onClose();
    } catch {
      setError('تعذّر إرسال الوصل. تحقق من الاتصال وحاول مجدداً.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={`إرفاق وصل دفع — ${child.name}`}
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="إرسال للمراجعة"
      submitting={submitting}
      error={error}
      width={520}
    >
      <div className="dialog-body">
        المستحق حالياً <strong>{formatILS(dueMinorUnits)}</strong>. بعد إرسال الوصل يبقى الرصيد كما هو حتى تعتمد الإدارة أو المحاسب الدفعة.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="المبلغ المحوَّل (₪)">
          <input className="input" type="number" min="0.01" step="0.01" max={maxShekels || undefined} dir="ltr" style={{ textAlign: 'right' }} value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </Field>
        <Field label="رقم التحويل / المرجع (اختياري)">
          <input className="input" value={transferRef} onChange={(e) => setTransferRef(e.target.value)} placeholder="مثال: TRX-8821" dir="ltr" style={{ textAlign: 'right' }} />
        </Field>
      </div>
      <Field label="اسم الحساب البنكي (المستفيد)">
        <input className="input" value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} required />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="اسم المحوّل">
          <input className="input" value={payerName} onChange={(e) => setPayerName(e.target.value)} required />
        </Field>
        <Field label="رقم الهاتف">
          <input className="input" value={payerPhone} onChange={(e) => setPayerPhone(e.target.value)} required dir="ltr" style={{ textAlign: 'right' }} placeholder="05XXXXXXXX" />
        </Field>
      </div>
      <Field label="ملاحظة (اختياري)">
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: قسط الفصل الأول" />
      </Field>
      <Field label="صورة الوصل أو PDF">
        <input className="input" type="file" accept="image/*,.pdf,application/pdf" onChange={onFile} required={!demo} />
      </Field>
      {previewUrl && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', overflow: 'hidden', maxHeight: 180 }}>
          <img src={previewUrl} alt="معاينة الوصل" style={{ width: '100%', display: 'block', objectFit: 'contain', maxHeight: 180, background: 'var(--color-neutral-100)' }} />
        </div>
      )}
    </Modal>
  );
}
