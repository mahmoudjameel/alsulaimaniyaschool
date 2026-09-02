import { useEffect, useState } from 'react';
import Modal from '../components/Modal';
import { Field } from '../components/ui';
import SubjectIdsPicker from '../components/SubjectIdsPicker';
import { updateTeacherProfile } from '../services/teachers';
import { setTeacherSubjects, teacherSubjectIds } from '../services/teachingSubjects';
import { logActivity } from '../services/activity';
import { useAuth } from '../context/AuthContext';
import { useTeachingSubjects } from '../hooks/useTeachingSubjects';

export default function EditTeacherModal({ teacher, onClose, demo }) {
  const { profile } = useAuth();
  const { subjects, byId } = useTeachingSubjects();
  const [name, setName] = useState(teacher?.name || '');
  const [subjectIds, setSubjectIds] = useState(() => teacherSubjectIds(teacher));
  const [bio, setBio] = useState(teacher?.bio || '');
  const [email, setEmail] = useState(teacher?.email || '');
  const [phone, setPhone] = useState(teacher?.phone || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (subjectIds.length) return;
    const fromTeacher = teacherSubjectIds(teacher);
    if (fromTeacher.length) setSubjectIds(fromTeacher);
    else if (subjects[0]?.id) setSubjectIds([subjects[0].id]);
  }, [subjects, teacher, subjectIds.length]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (demo) { setError('وضع العرض: صِل Firebase لحفظ التعديل.'); return; }
    if (!teacher?.id) return;
    if (!name.trim()) { setError('الاسم مطلوب.'); return; }
    const subjectLabels = subjectIds.map((id) => byId.get(id)?.labelAr).filter(Boolean);
    const subjectLabel = subjectLabels.join(' · ') || '—';
    setSubmitting(true);
    setError('');
    try {
      await updateTeacherProfile(teacher.id, {
        name: name.trim(),
        bio: bio || '',
        email: email || '',
        phone: phone || '',
        initial: name.trim().charAt(0),
      });
      await setTeacherSubjects(teacher.id, subjectIds);
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
      <div className="dialog-body">يظهر التعديل في دليل المعلّمين وعلى الموقع العام. يمكن ربط المعلّم بأكثر من مادة.</div>
      <Field label="اسم المعلّم">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <Field label="المواد التي يدرّسها">
        <SubjectIdsPicker subjects={subjects} selectedIds={subjectIds} onChange={setSubjectIds} />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="البريد الإلكتروني">
          <input className="input" type="email" dir="ltr" style={{ textAlign: 'right' }} value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="رقم الهاتف">
          <input className="input" dir="ltr" style={{ textAlign: 'right' }} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
      </div>
      <Field label="نبذة مختصرة">
        <textarea className="input" value={bio} onChange={(e) => setBio(e.target.value)} />
      </Field>
    </Modal>
  );
}
