import { useState } from 'react';
import Modal from '../components/Modal';
import { Field } from '../components/ui';
import { updateTeacherProfile } from '../services/teachers';
import { logActivity } from '../services/activity';
import { useAuth } from '../context/AuthContext';

const SUBJECTS = [
  'اللغة العربية', 'الرياضيات', 'العلوم', 'اللغة الإنجليزية', 'التربية الإسلامية',
  'الفنون', 'الحاسوب والتقنية', 'التربية الرياضية', 'لغة عربية', 'رياضيات', 'علوم', 'إنجليزي',
];

export default function EditTeacherModal({ teacher, onClose, demo }) {
  const { profile } = useAuth();
  const [name, setName] = useState(teacher?.name || '');
  const [subject, setSubject] = useState(teacher?.subject || SUBJECTS[0]);
  const [bio, setBio] = useState(teacher?.bio || '');
  const [email, setEmail] = useState(teacher?.email || '');
  const [phone, setPhone] = useState(teacher?.phone || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    if (demo) { setError('وضع العرض: صِل Firebase لحفظ التعديل.'); return; }
    if (!teacher?.id) return;
    if (!name.trim()) { setError('الاسم مطلوب.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await updateTeacherProfile(teacher.id, {
        name: name.trim(),
        subject: subject || '—',
        bio: bio || '',
        email: email || '',
        phone: phone || '',
        initial: name.trim().charAt(0),
      });
      await logActivity({
        type: 'teacher_updated',
        actorUid: profile?.id,
        actorName: profile?.name,
        actorRole: profile?.role,
        summary: `تعديل ملف معلّم: ${name.trim()}`,
        targetType: 'teacherProfile',
        targetId: teacher.id,
      });
      onClose();
    } catch {
      setError('تعذّر حفظ التعديل.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="تعديل ملف المعلّم" onClose={onClose} onSubmit={onSubmit} submitLabel="حفظ التعديلات" submitting={submitting} error={error} width={480}>
      <div className="dialog-body">يظهر التعديل في دليل المعلّمين وعلى الموقع العام.</div>
      <Field label="اسم المعلّم">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="التخصّص">
          <select className="input" value={subject} onChange={(e) => setSubject(e.target.value)}>
            {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
            {subject && !SUBJECTS.includes(subject) && <option value={subject}>{subject}</option>}
          </select>
        </Field>
        <Field label="البريد الإلكتروني">
          <input className="input" type="email" dir="ltr" style={{ textAlign: 'right' }} value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
      </div>
      <Field label="رقم الهاتف">
        <input className="input" dir="ltr" style={{ textAlign: 'right' }} value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <Field label="نبذة مختصرة">
        <textarea className="input" value={bio} onChange={(e) => setBio(e.target.value)} />
      </Field>
    </Modal>
  );
}
