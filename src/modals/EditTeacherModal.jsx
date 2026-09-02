import { useEffect, useState } from 'react';
import Modal from '../components/Modal';
import { Field } from '../components/ui';
import { updateTeacherProfile } from '../services/teachers';
import { assignTeacherSubject, findSubjectByLabel } from '../services/teachingSubjects';
import { logActivity } from '../services/activity';
import { useAuth } from '../context/AuthContext';
import { useTeachingSubjects } from '../hooks/useTeachingSubjects';

export default function EditTeacherModal({ teacher, onClose, demo }) {
  const { profile } = useAuth();
  const { subjects, byId } = useTeachingSubjects();
  const [name, setName] = useState(teacher?.name || '');
  const [subjectId, setSubjectId] = useState(teacher?.subjectId || '');
  const [bio, setBio] = useState(teacher?.bio || '');
  const [email, setEmail] = useState(teacher?.email || '');
  const [phone, setPhone] = useState(teacher?.phone || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (subjectId) return;
    const fromLabel = findSubjectByLabel(subjects, teacher?.subject);
    if (fromLabel?.id) setSubjectId(fromLabel.id);
    else if (subjects[0]?.id) setSubjectId(subjects[0].id);
  }, [subjects, teacher, subjectId]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (demo) { setError('وضع العرض: صِل Firebase لحفظ التعديل.'); return; }
    if (!teacher?.id) return;
    if (!name.trim()) { setError('الاسم مطلوب.'); return; }
    const picked = byId.get(subjectId);
    const subjectLabel = picked?.labelAr || teacher?.subject || '—';
    setSubmitting(true);
    setError('');
    try {
      await updateTeacherProfile(teacher.id, {
        name: name.trim(),
        subjectId: subjectId || null,
        subject: subjectLabel,
        bio: bio || '',
        email: email || '',
        phone: phone || '',
        initial: name.trim().charAt(0),
      });
      if (subjectId) {
        await assignTeacherSubject(teacher.id, subjectId, {
          previousSubjectId: teacher.subjectId,
        });
      }
      await logActivity({
        type: 'teacher_updated',
        actorUid: profile?.id,
        actorName: profile?.name,
        actorRole: profile?.role,
        summary: `تعديل ملف معلّم: ${name.trim()} — ${subjectLabel}`,
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
        <Field label="التخصّص (من مواد التدريس)">
          <select className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            {subjects.length === 0 && <option value="">—</option>}
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.labelAr}</option>
            ))}
            {subjectId && !subjects.some((s) => s.id === subjectId) && teacher?.subject && (
              <option value={subjectId}>{teacher.subject}</option>
            )}
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
