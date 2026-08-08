import { useState } from 'react';
import Icon from '../../components/Icon';
import { EmptyRow, ErrorBanner, Field } from '../../components/ui';
import { useAcademicStages } from '../../hooks/useAcademicStages';
import { formatILS } from '../../lib/constants';
import {
  createStage, deleteStage, seedDefaultStages, setStageMonthlyFee, setStageSeatFee, updateStage,
} from '../../services/stages';

const CATEGORIES = [
  { id: 'preschool', label: 'روضة / تمهيدي' },
  { id: 'primary', label: 'أساسي' },
  { id: 'secondary', label: 'ثانوي' },
];

function seatLabel(minor) {
  if (minor == null || Number(minor) <= 0) return 'بدون حجز';
  return formatILS(minor);
}

export default function AcademicStages() {
  const { stages, demo, error } = useAcademicStages();
  const [labelAr, setLabelAr] = useState('');
  const [category, setCategory] = useState('primary');
  const [ageRange, setAgeRange] = useState('');
  const [monthlyFee, setMonthlyFee] = useState('400');
  const [seatFee, setSeatFee] = useState('50');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editFee, setEditFee] = useState('');
  const [editSeat, setEditSeat] = useState('');

  const onAdd = async (e) => {
    e.preventDefault();
    if (!labelAr.trim()) return;
    if (demo) { setMessage('وضع العرض التوضيحي: صِل Firebase لحفظ المراحل فعلياً.'); return; }
    setBusy(true);
    setMessage('');
    try {
      await createStage({
        labelAr,
        category,
        ageRange,
        order: stages.length,
        monthlyTuitionShekels: monthlyFee,
        seatReservationShekels: seatFee,
      });
      setLabelAr('');
      setAgeRange('');
      setMessage('أُضيفت المرحلة مع الرسوم الشهرية وحجز المقعد.');
    } catch {
      setMessage('تعذّر إضافة المرحلة.');
    } finally {
      setBusy(false);
    }
  };

  const onSeed = async () => {
    if (demo) { setMessage('وضع العرض التوضيحي: صِل Firebase لزرع المراحل.'); return; }
    setBusy(true);
    try {
      await seedDefaultStages();
      setMessage('زُرعت المراحل الافتراضية مع رسوم شهرية وحجز مقعد ₪50 لكل مرحلة.');
    } catch {
      setMessage('تعذّر الزرع.');
    } finally {
      setBusy(false);
    }
  };

  const onToggle = async (stage) => {
    if (demo) return;
    await updateStage(stage.id, { active: stage.active === false });
  };

  const onSaveEdit = async (stage) => {
    if (demo || !editLabel.trim()) return;
    await updateStage(stage.id, { labelAr: editLabel.trim() });
    if (editFee !== '') await setStageMonthlyFee(stage.id, editFee);
    if (editSeat !== '') await setStageSeatFee(stage.id, editSeat);
    setEditingId(null);
  };

  const onDelete = async (stage) => {
    if (demo) return;
    if (!window.confirm(`حذف المرحلة «${stage.labelAr}»؟`)) return;
    await deleteStage(stage.id);
  };

  const onMove = async (stage, dir) => {
    if (demo) return;
    const idx = stages.findIndex((s) => s.id === stage.id);
    const swap = stages[idx + dir];
    if (!swap) return;
    await Promise.all([
      updateStage(stage.id, { order: swap.order ?? idx + dir }),
      updateStage(swap.id, { order: stage.order ?? idx }),
    ]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ErrorBanner>{error && 'تعذّر تحميل المراحل الدراسية.'}</ErrorBanner>
      <div className="card" style={{ borderColor: 'var(--color-accent-300)', background: 'var(--color-accent-100)', padding: '14px 16px' }}>
        <div style={{ fontSize: 13, color: 'var(--color-accent-900)', lineHeight: 1.7 }}>
          حدّد <strong>الرسوم الشهرية</strong> و<strong>حجز المقعد</strong> لكل مرحلة.
          حجز المقعد اختياري — إن وُجد مبلغ أكبر من صفر يُسجَّل تلقائياً كفاتورة عند قبول التسجيل أو إضافة طالب جديد.
        </div>
      </div>

      <form className="card" onSubmit={onAdd}>
        <div className="card-title" style={{ marginBottom: 10 }}>إضافة مرحلة دراسية</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 12, alignItems: 'end' }}>
          <Field label="اسم المرحلة">
            <input className="input" placeholder="مثال: السابع الأساسي" value={labelAr} onChange={(e) => setLabelAr(e.target.value)} required />
          </Field>
          <Field label="التصنيف">
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="الفئة العمرية">
            <input className="input" placeholder="6–7 سنوات" value={ageRange} onChange={(e) => setAgeRange(e.target.value)} />
          </Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end', marginTop: 12 }}>
          <Field label="الرسوم الشهرية (₪)">
            <input className="input" type="number" min="0" step="1" value={monthlyFee} onChange={(e) => setMonthlyFee(e.target.value)} dir="ltr" style={{ textAlign: 'right' }} />
          </Field>
          <Field label="حجز مقعد (₪)">
            <input className="input" type="number" min="0" step="1" value={seatFee} onChange={(e) => setSeatFee(e.target.value)} dir="ltr" style={{ textAlign: 'right' }} placeholder="50" />
            <div style={{ fontSize: 11, color: 'var(--color-neutral-500)', marginTop: 4 }}>اختياري — يُحصَّل عند قبول التسجيل · 0 = بدون حجز</div>
          </Field>
          <button type="submit" className="btn btn-primary" disabled={busy} style={{ height: 42 }}>
            <Icon name="add" size={14} /> إضافة
          </button>
        </div>
      </form>

      {message && <div style={{ fontSize: 13, color: 'var(--color-accent-700)' }}>{message}</div>}

      <div className="card ah-table-wrap" style={{ padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
          <h4 style={{ margin: 0 }}>المراحل · الرسوم · حجز المقعد</h4>
          <span style={{ marginInlineStart: 'auto' }} />
          {stages.length === 0 && (
            <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={onSeed} disabled={busy}>
              زرع المراحل + الرسوم الافتراضية
            </button>
          )}
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>المرحلة</th>
              <th>التصنيف</th>
              <th>العمر</th>
              <th>الرسوم الشهرية</th>
              <th>حجز مقعد</th>
              <th>الحالة</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {stages.length === 0 && <EmptyRow colSpan={8}>لا توجد مراحل بعد — أضف مرحلة أو ازرع الافتراضية.</EmptyRow>}
            {stages.map((s, i) => (
              <tr key={s.id} style={{ opacity: s.active === false ? 0.55 : 1 }}>
                <td className="ah-tabnum">{(s.order ?? i) + 1}</td>
                <td>
                  {editingId === s.id ? (
                    <input className="input" style={{ fontSize: 13, padding: '4px 8px' }} value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
                  ) : s.labelAr}
                </td>
                <td>{CATEGORIES.find((c) => c.id === s.category)?.label || s.category || '—'}</td>
                <td>{s.ageRange || '—'}</td>
                <td>
                  {editingId === s.id ? (
                    <input
                      className="input"
                      style={{ fontSize: 13, padding: '4px 8px', width: 90 }}
                      type="number"
                      dir="ltr"
                      value={editFee}
                      onChange={(e) => setEditFee(e.target.value)}
                      placeholder="شهري"
                    />
                  ) : (
                    <span className="ah-tabnum" style={{ fontWeight: 600, color: 'var(--gold)' }}>
                      {s.monthlyTuitionMinorUnits != null ? formatILS(s.monthlyTuitionMinorUnits) : '— غير محدّد'}
                    </span>
                  )}
                </td>
                <td>
                  {editingId === s.id ? (
                    <input
                      className="input"
                      style={{ fontSize: 13, padding: '4px 8px', width: 90 }}
                      type="number"
                      dir="ltr"
                      value={editSeat}
                      onChange={(e) => setEditSeat(e.target.value)}
                      placeholder="حجز"
                    />
                  ) : (
                    <span className={`tag ${s.seatReservationMinorUnits > 0 ? 'tag-accent' : 'tag-neutral'}`} style={{ fontSize: 11 }}>
                      {seatLabel(s.seatReservationMinorUnits)}
                    </span>
                  )}
                </td>
                <td>
                  <span className={`tag tag-${s.active === false ? 'neutral' : 'accent'}`}>
                    {s.active === false ? 'موقوفة' : 'نشطة'}
                  </span>
                </td>
                <td style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>
                  {editingId === s.id ? (
                    <>
                      <button className="btn btn-primary" style={{ fontSize: 11, padding: '4px 10px' }} type="button" onClick={() => onSaveEdit(s)}>حفظ</button>{' '}
                      <button className="btn btn-ghost" style={{ fontSize: 11 }} type="button" onClick={() => setEditingId(null)}>إلغاء</button>
                    </>
                  ) : (
                    <>
                      <button className="btn btn-ghost" style={{ fontSize: 11 }} type="button" onClick={() => onMove(s, -1)} disabled={i === 0}>↑</button>
                      <button className="btn btn-ghost" style={{ fontSize: 11 }} type="button" onClick={() => onMove(s, 1)} disabled={i === stages.length - 1}>↓</button>
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: 11 }}
                        type="button"
                        onClick={() => {
                          setEditingId(s.id);
                          setEditLabel(s.labelAr);
                          setEditFee(s.monthlyTuitionMinorUnits != null ? String(s.monthlyTuitionMinorUnits / 100) : '');
                          setEditSeat(s.seatReservationMinorUnits != null ? String(s.seatReservationMinorUnits / 100) : '0');
                        }}
                      >
                        تعديل / رسوم
                      </button>
                      <button className="btn btn-ghost" style={{ fontSize: 11 }} type="button" onClick={() => onToggle(s)}>{s.active === false ? 'تفعيل' : 'إيقاف'}</button>
                      <button className="btn btn-ghost" style={{ fontSize: 11 }} type="button" onClick={() => onDelete(s)}>حذف</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
