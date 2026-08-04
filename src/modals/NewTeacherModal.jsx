import { useState } from 'react';
import Modal from '../components/Modal';
import { Field } from '../components/ui';
import { createTeacherProfile } from '../services/teachers';

const SUBJECTS = ['اللغة العربية', 'الرياضيات', 'العلوم', 'اللغة الإنجليزية', 'التربية الإسلامية', 'الفنون', 'الحاسوب والتقنية', 'التربية الرياضية'];

export default function NewTeacherModal({ onClose, demo }) {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [bio, setBio] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    if (demo) { setError('وضع العرض التوضيحي: صِل مشروع Firebase لإضافة معلّمين فعلياً.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await createTeacherProfile({ name, subject, bio, email, phone });
      onClose();
    } catch {
      setError('تعذّر حفظ ملف المعلّم. حاول مجدداً.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="إضافة معلّم إلى الدليل" onClose={onClose} onSubmit={onSubmit} submitLabel="حفظ" submitting={submitting} error={error} width={480}>
      <div className="dialog-body">يظهر هذا الملف في دليل المعلّمين وعلى الموقع العام، ويمكن ربطه بصفّ من شاشة "صفّ جديد". لإنشاء حساب دخول فعلي للمعلّم استخدم "المستخدمون والصلاحيات" بدلاً من ذلك.</div>
      <Field label="اسم المعلّم"><input className="input" placeholder="مثال: أ. سارة يوسف" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="التخصّص">
          <select className="input" value={subject} onChange={(e) => setSubject(e.target.value)}>
            {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="البريد الإلكتروني (اختياري)"><input className="input" type="email" dir="ltr" style={{ textAlign: 'right' }} value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      </div>
      <Field label="رقم الهاتف (اختياري)"><input className="input" dir="ltr" style={{ textAlign: 'right' }} placeholder="0599 000 000" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
      <Field label="نبذة مختصرة (اختياري)"><textarea className="input" placeholder="خبرات أو أسلوب تدريس مميّز…" value={bio} onChange={(e) => setBio(e.target.value)} /></Field>
    </Modal>
  );
}
