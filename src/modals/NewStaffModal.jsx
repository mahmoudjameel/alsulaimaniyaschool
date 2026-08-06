import { useState } from 'react';
import Modal from '../components/Modal';
import { Field } from '../components/ui';
import { createStaffAccount } from '../services/users';
import { ROLE_LABELS, STAFF_ROLES } from '../lib/permissions';
import { SCHOOL_EMAIL_DOMAIN } from '../lib/constants';

export default function NewStaffModal({ onClose, demo }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('director');
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (demo) { setError('وضع العرض التوضيحي: صِل مشروع Firebase لإنشاء حسابات فعلية.'); return; }
    if (password.trim().length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await createStaffAccount({ name, email, role, title, password: password.trim() });
      setResult(res.data);
    } catch (err) {
      const msg = err?.message || '';
      if (msg.includes('كلمة المرور')) setError(msg);
      else setError('تعذّر إنشاء الحساب. تأكّد أن البريد غير مستخدم سابقاً.');
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <Modal title="تم إنشاء الحساب" onClose={onClose} onSubmit={(e) => { e.preventDefault(); onClose(); }} submitLabel="تم" width={440}>
        <div className="dialog-body">شارك بيانات الدخول التالية مع {name} بطريقة آمنة.</div>
        <div className="card" style={{ gap: 6 }}>
          <div style={{ fontSize: 13 }}>البريد: <strong dir="ltr">{email}</strong></div>
          <div style={{ fontSize: 13 }}>كلمة المرور: <strong dir="ltr" className="ah-tabnum">{result.tempPassword}</strong></div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="دعوة مستخدم جديد" onClose={onClose} onSubmit={onSubmit} submitLabel="إنشاء الحساب" submitting={submitting} error={error} width={460}>
      <div className="dialog-body">يُنشأ حساب دخول فوراً بكلمة المرور التي تحدّدها هنا.</div>
      <Field label="الاسم الكامل"><input className="input" placeholder="مثال: ليلى حسن" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
      <Field label="البريد الإلكتروني"><input className="input" type="email" placeholder={`name@${SCHOOL_EMAIL_DOMAIN}`} dir="ltr" style={{ textAlign: 'right' }} value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
      <Field label="كلمة المرور">
        <input
          className="input"
          type="text"
          autoComplete="new-password"
          placeholder="6 أحرف على الأقل"
          dir="ltr"
          style={{ textAlign: 'right' }}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="الدور">
          <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
            {STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </Field>
        <Field label="المسمّى الوظيفي">
          <input
            className="input"
            placeholder={role === 'director' ? 'مثال: مديرة المدرسة' : 'مثال: مسؤولة مالية'}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}
