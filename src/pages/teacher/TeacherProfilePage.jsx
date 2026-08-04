import { useEffect, useState } from 'react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { ErrorBanner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useDocOrDemo } from '../../hooks/useFirestore';
import { db, isFirebaseConfigured } from '../../firebase/config';
import { updateTeacherProfile } from '../../services/teachers';

export default function TeacherProfilePage() {
  const { profile } = useAuth();
  const uid = profile?.id;
  const { data: userDoc, demo, error } = useDocOrDemo(uid ? `users/${uid}` : null, null);
  const { data: teacherDoc } = useDocOrDemo(uid ? `teacherProfiles/${uid}` : null, null);

  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [bio, setBio] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setPhone(userDoc?.phone || userDoc?.contactPhone || teacherDoc?.phone || '');
    setWhatsapp(userDoc?.whatsapp || userDoc?.contactWhatsApp || teacherDoc?.whatsapp || teacherDoc?.phone || '');
    setBio(teacherDoc?.bio || '');
  }, [userDoc, teacherDoc]);

  const onSave = async (e) => {
    e.preventDefault();
    if (demo || !isFirebaseConfigured || !uid) {
      setMessage('وضع العرض: صِل Firebase لحفظ الملف.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await updateDoc(doc(db, 'users', uid), {
        phone: phone.trim(),
        whatsapp: whatsapp.trim(),
        contactPhone: phone.trim(),
        contactWhatsApp: whatsapp.trim(),
        updatedAt: serverTimestamp(),
      });
      try {
        await updateTeacherProfile(uid, {
          phone: phone.trim(),
          whatsapp: whatsapp.trim(),
          bio: bio.trim(),
          updatedAt: serverTimestamp(),
        });
      } catch {
        // Profile doc may not exist with same id — users fields still saved.
      }
      setMessage('تم حفظ بيانات التواصل.');
    } catch {
      setMessage('تعذّر الحفظ. تأكد من صلاحيات التحديث.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 520 }}>
      <ErrorBanner>{error && 'تعذّر تحميل الملف.'}</ErrorBanner>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)', lineHeight: 1.7 }}>
        حدّث هاتفك وواتساب للتواصل مع الإدارة وأولياء الأمور. لا يشمل صلاحيات إدارية.
      </p>

      <form className="card" onSubmit={onSave} style={{ gap: 12 }}>
        <div className="card-title" style={{ margin: 0 }}>ملفي كمعلّم</div>
        <div style={{ fontSize: 14 }}>
          <strong>{profile?.name || '—'}</strong>
          <div style={{ color: 'var(--color-neutral-600)', fontSize: 13 }}>{profile?.email || userDoc?.email || '—'}</div>
          <div style={{ color: 'var(--color-neutral-500)', fontSize: 12, marginTop: 4 }}>{profile?.title || 'معلّم'}</div>
        </div>
        <div className="field">
          <label>هاتف</label>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" placeholder="05xxxxxxxx" />
        </div>
        <div className="field">
          <label>واتساب</label>
          <input className="input" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} dir="ltr" placeholder="نفس الرقم أو رقم آخر" />
        </div>
        <div className="field">
          <label>نبذة قصيرة (اختياري)</label>
          <textarea className="input" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>
        {message && <div style={{ fontSize: 13, color: 'var(--color-accent-700)' }}>{message}</div>}
        <button type="submit" className="btn btn-primary" disabled={busy} style={{ width: 'fit-content' }}>
          <Icon name="save" size={14} /> {busy ? 'جارٍ الحفظ…' : 'حفظ'}
        </button>
      </form>
    </div>
  );
}
