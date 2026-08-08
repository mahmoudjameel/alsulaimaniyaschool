import { useState } from 'react';
import Modal from '../components/Modal';
import { Field } from '../components/ui';
import { createStaffAccount } from '../services/users';
import { updateTeacherProfile } from '../services/teachers';
import { SCHOOL_EMAIL_DOMAIN } from '../lib/constants';

const SUBJECTS = [
  'اللغة العربية',
  'الرياضيات',
  'العلوم',
  'اللغة الإنجليزية',
  'التربية الإسلامية',
  'الفنون',
  'الحاسوب والتقنية',
  'التربية الرياضية',
];

export default function NewTeacherModal({ onClose, demo }) {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [bio, setBio] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (demo) {
      setError('وضع العرض التوضيحي: صِل مشروع Firebase لإضافة معلّمين فعلياً.');
      return;
    }
    const trimmedEmail = email.trim();
    const trimmedPass = password.trim();
    if (!trimmedEmail) {
      setError('البريد الإلكتروني مطلوب لربط المعلّم بالنظام.');
      return;
    }
    if (trimmedPass.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await createStaffAccount({
        name: name.trim(),
        email: trimmedEmail,
        role: 'teacher',
        title: subject,
        password: trimmedPass,
        phone: phone.trim() || undefined,
      });
      const uid = res.data?.uid;
      if (uid && (bio.trim() || subject)) {
        try {
          await updateTeacherProfile(uid, {
            subject: subject || '—',
            bio: bio.trim(),
            phone: phone.trim() || '',
          });
        } catch {
          /* profile already created by CF; bio is optional */
        }
      }
      setCreated({
        email: res.data?.email || trimmedEmail,
        tempPassword: res.data?.tempPassword || trimmedPass,
        name: name.trim(),
      });
    } catch (err) {
      const msg = err?.message || '';
      const code = err?.code || '';
      if (code === 'functions/already-exists' || msg.includes('مستخدم مسبقاً')) {
        setError('هذا البريد مستخدم مسبقاً — المعلّم مربوط مسبقاً أو استخدم بريداً آخر.');
      } else if (msg.includes('كلمة المرور')) {
        setError(msg);
      } else if (code === 'functions/permission-denied' || msg.includes('صلاحية')) {
        setError('ليست لديك صلاحية إنشاء حساب معلّم.');
      } else {
        setError('تعذّر إنشاء حساب المعلّم. تأكّد من البريد وكلمة المرور.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (created) {
    return (
      <Modal
        title="تم ربط المعلّم بالنظام"
        onClose={onClose}
        onSubmit={(e) => { e.preventDefault(); onClose(); }}
        submitLabel="تم"
        width={460}
      >
        <div className="dialog-body">
          أُضيف {created.name} إلى دليل المعلّمين مع حساب دخول. شارك البيانات التالية بطريقة آمنة.
        </div>
        <div className="card" style={{ gap: 8 }}>
          <div style={{ fontSize: 13 }}>البريد: <strong dir="ltr">{created.email}</strong></div>
          <div style={{ fontSize: 13 }}>كلمة المرور: <strong dir="ltr" className="ah-tabnum">{created.tempPassword}</strong></div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
            يسجّل الدخول من بوابة المعلّم بنفس البريد وكلمة المرور.
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="إضافة معلّم إلى الدليل"
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="إنشاء الحساب وربطه"
      submitting={submitting}
      error={error}
      width={500}
    >
      <div className="dialog-body">
        يُنشأ حساب دخول فوراً (بريد + كلمة مرور) ويُربط بدليل المعلّمين وصفحة المعلّم في النظام.
      </div>
      <Field label="اسم المعلّم">
        <input
          className="input"
          placeholder="مثال: أ. سارة يوسف"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </Field>
      <Field label="التخصّص">
        <select className="input" value={subject} onChange={(e) => setSubject(e.target.value)}>
          {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="البريد الإلكتروني (للدخول)">
        <input
          className="input"
          type="email"
          placeholder={`name@${SCHOOL_EMAIL_DOMAIN}`}
          dir="ltr"
          style={{ textAlign: 'right' }}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="off"
        />
      </Field>
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
      <Field label="رقم الهاتف (اختياري)">
        <input
          className="input"
          dir="ltr"
          style={{ textAlign: 'right' }}
          placeholder="0599 000 000"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </Field>
      <Field label="نبذة مختصرة (اختياري)">
        <textarea
          className="input"
          placeholder="خبرات أو أسلوب تدريس مميّز…"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
      </Field>
    </Modal>
  );
}
