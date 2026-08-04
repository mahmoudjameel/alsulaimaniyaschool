import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import { ErrorBanner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useMyClasses } from '../../hooks/useMyClasses';
import { useDocOrDemo } from '../../hooks/useFirestore';
import { saveDayLog } from '../../services/dayLog';

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function TeacherDiary() {
  const { profile } = useAuth();
  const [params] = useSearchParams();
  const { myClasses, error: classesError, demo: classesDemo } = useMyClasses();
  const [classId, setClassId] = useState(params.get('class') || '');
  const activeClassId = classId || myClasses[0]?.id || '';
  const activeClass = myClasses.find((c) => c.id === activeClassId);
  const [date, setDate] = useState(todayStr());

  useEffect(() => {
    const fromUrl = params.get('class');
    if (fromUrl) setClassId(fromUrl);
  }, [params]);

  const { data: existing, demo } = useDocOrDemo(
    activeClassId ? `classes/${activeClassId}/dayLogs/${date}` : null,
    null,
  );

  const [topic, setTopic] = useState('');
  const [homework, setHomework] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setTopic(existing?.topic || '');
    setHomework(existing?.homework || '');
    setNotice(existing?.notice || '');
    setMessage('');
  }, [existing, activeClassId, date]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!activeClass) return;
    if (demo || classesDemo) {
      setMessage('وضع العرض: صِل Firebase لحفظ دفتر اليوم فعلياً.');
      return;
    }
    setSubmitting(true);
    setMessage('');
    try {
      await saveDayLog({
        classId: activeClassId,
        className: activeClass.title,
        subject: activeClass.subject,
        teacherId: profile.id,
        teacherName: profile.name,
        date,
        topic,
        homework,
        notice,
      });
      setMessage('تم حفظ دفتر اليوم.');
    } catch {
      setMessage('تعذّر الحفظ. تأكد من صلاحيات الكتابة.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ErrorBanner>{classesError && 'تعذّر تحميل الصفوف.'}</ErrorBanner>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)', lineHeight: 1.7 }}>
        سجّل موضوع الحصة، الواجب، وتنبيهاً قصيراً للصف — يوم بيوم.
      </p>

      <form className="card" onSubmit={onSubmit} style={{ gap: 12, maxWidth: 640 }}>
        <div className="card-title" style={{ margin: 0 }}>دفتر اليوم</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="field">
            <label>الصف</label>
            <select className="input" value={activeClassId} onChange={(e) => setClassId(e.target.value)}>
              {myClasses.length === 0 && <option value="">لا صفوف مسندة</option>}
              {myClasses.map((c) => (
                <option key={c.id} value={c.id}>{c.title} — {c.subject}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>التاريخ</label>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} dir="ltr" />
          </div>
        </div>
        <div className="field">
          <label>موضوع الحصة</label>
          <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="مثال: المدّ بالألف — تمارين قراءة" />
        </div>
        <div className="field">
          <label>الواجب البيتي</label>
          <textarea className="input" rows={3} value={homework} onChange={(e) => setHomework(e.target.value)} placeholder="ما يُطلب من الطلاب لليوم التالي…" style={{ resize: 'vertical' }} />
        </div>
        <div className="field">
          <label>تنبيه قصير للصف</label>
          <textarea className="input" rows={2} value={notice} onChange={(e) => setNotice(e.target.value)} placeholder="اختياري — إحضار كتاب، اختبار غداً…" style={{ resize: 'vertical' }} />
        </div>
        {message && <div style={{ fontSize: 12, color: 'var(--color-accent-700)' }}>{message}</div>}
        <button type="submit" className="btn btn-primary" disabled={submitting || !myClasses.length} style={{ width: 'fit-content' }}>
          <Icon name="save" size={14} /> {submitting ? 'جارٍ الحفظ…' : 'حفظ دفتر اليوم'}
        </button>
      </form>
    </div>
  );
}
