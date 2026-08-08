import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/Modal';
import SearchInput from '../components/SearchInput';
import { Field } from '../components/ui';
import { createManualCharge } from '../services/finance';
import { filterByStudentSearch } from '../lib/studentSearch';
import { formatILS } from '../lib/constants';
import {
  FEE_TYPE_OPTIONS,
  SEAT_RESERVATION_TYPE,
  MONTHLY_TUITION_TYPE,
  isSeatReservationType,
  resolveSeatFeeMinorUnits,
  resolveMonthlyFeeMinorUnits,
} from '../lib/feeTypes';
import { useAcademicStages } from '../hooks/useAcademicStages';

const METHODS = ['نقد', 'تحويل', 'شيك'];

export default function NewInvoiceModal({
  students, onClose, demo, defaultType, stages: stagesProp, onSaved, redirectAfterSeat = true,
}) {
  const navigate = useNavigate();
  const { stages: stagesHook } = useAcademicStages();
  const stages = stagesProp || stagesHook;
  const [studentId, setStudentId] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState(defaultType || FEE_TYPE_OPTIONS[0]);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState(METHODS[0]);
  const [receiptFile, setReceiptFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const options = useMemo(() => filterByStudentSearch(students, search), [students, search]);
  const student = students.find((s) => s.id === studentId);

  useEffect(() => {
    if (!student) return;
    if (isSeatReservationType(type)) {
      const seat = resolveSeatFeeMinorUnits(student, stages);
      if (seat > 0) setAmount(String(seat / 100));
    } else if (type === MONTHLY_TUITION_TYPE) {
      const monthly = resolveMonthlyFeeMinorUnits(student, stages);
      if (monthly > 0) setAmount(String(monthly / 100));
    }
  }, [studentId, type, student, stages]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (demo) { setError('وضع العرض التوضيحي: صِل مشروع Firebase لرفع الفواتير فعلياً.'); return; }
    if (!student) { setError('اختر طالباً.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await createManualCharge({
        studentId,
        studentName: student.name,
        type,
        amountShekels: amount,
        method,
        receiptFile,
        stageId: student.stageId || null,
        stageLabel: student.stageLabel || null,
        classSection: student.classSection || null,
        grade: student.grade || null,
      });
      onSaved?.();
      onClose();
      if (redirectAfterSeat && isSeatReservationType(type)) {
        const path = window.location.pathname.includes('/accountant')
          ? '/accountant/seat-reservations'
          : '/admin/seat-reservations';
        navigate(path);
      }
    } catch {
      setError('تعذّر حفظ الفاتورة. حاول مجدداً.');
    } finally {
      setSubmitting(false);
    }
  };

  const seatHint = student && isSeatReservationType(type)
    ? resolveSeatFeeMinorUnits(student, stages)
    : 0;
  const monthlyHint = student && type === MONTHLY_TUITION_TYPE
    ? resolveMonthlyFeeMinorUnits(student, stages)
    : 0;

  return (
    <Modal
      title={isSeatReservationType(type) ? 'تسجيل حجز مقعد' : 'رفع فاتورة جديدة'}
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel={isSeatReservationType(type) ? 'حفظ حجز المقعد' : 'حفظ الفاتورة'}
      submitting={submitting}
      error={error}
      width={480}
    >
      <div className="dialog-body">
        {isSeatReservationType(type)
          ? 'حجز المقعد رسم لمرة واحدة حسب المرحلة — منفصل عن الأقساط الشهرية. بعد الحفظ تُفتح صفحة السجل والعدّاد.'
          : 'تُضاف الفاتورة لدفتر حساب الطالب فوراً ويُحدَّث رصيده المستحق تلقائياً.'}
      </div>
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
            {FEE_TYPE_OPTIONS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="المبلغ (₪)">
          <input className="input" type="number" min="0" step="0.01" placeholder="0" dir="ltr" style={{ textAlign: 'right' }} value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </Field>
      </div>
      {isSeatReservationType(type) && (
        <div style={{ fontSize: 12, color: 'var(--color-accent-800)', lineHeight: 1.6 }}>
          حجز مقعد للمرحلة{student?.stageLabel ? ` «${student.stageLabel}»` : ''}:
          {' '}
          <strong className="ah-tabnum">{seatHint > 0 ? formatILS(seatHint) : 'غير محدّد في المراحل'}</strong>
          {' — '}ليس رسماً شهرياً.
        </div>
      )}
      {type === MONTHLY_TUITION_TYPE && monthlyHint > 0 && (
        <div style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>
          القسط الشهري للمرحلة: <strong className="ah-tabnum">{formatILS(monthlyHint)}</strong>
        </div>
      )}
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
