import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { EmptyRow, ErrorBanner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useMyClasses } from '../../hooks/useMyClasses';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { submitClassExam } from '../../services/classExams';
import TermSelect, { useDefaultActiveTerm } from '../../components/TermSelect';
import { isTermClosed } from '../../services/academicCalendar';

export default function TeacherExams() {
  const { profile } = useAuth();
  const [params] = useSearchParams();
  const { myClasses, error, demo } = useMyClasses();
  const [classId, setClassId] = useState(params.get('class') || '');
  const activeClassId = classId || myClasses[0]?.id || '';
  const activeClass = myClasses.find((c) => c.id === activeClassId);

  const [title, setTitle] = useState('');
  const [examDate, setExamDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');
  const [term, setTerm] = useState('');
  const calendar = useDefaultActiveTerm(setTerm);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fromUrl = params.get('class');
    if (fromUrl) setClassId(fromUrl);
  }, [params]);

  const { data: exams } = useLiveOrDemo(
    'classExams',
    [where('teacherId', '==', profile?.id || '__none__')],
    [],
    profile?.id,
  );

  const list = useMemo(() => {
    const base = activeClassId ? (exams || []).filter((e) => e.classId === activeClassId) : (exams || []);
    return [...base].sort((a, b) => String(a.examDate).localeCompare(String(b.examDate)));
  }, [exams, activeClassId]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!activeClass || !title.trim() || !examDate) return;
    if (demo) { setMessage('وضع العرض: صِل Firebase.'); return; }
    setBusy(true);
    setMessage('');
    try {
      await submitClassExam({
        classId: activeClassId,
        className: activeClass.title,
        subject: activeClass.subject,
        teacherId: profile.id,
        teacherName: profile.name,
        title,
        examDate,
        startTime,
        endTime,
        notes,
        grade: activeClass.grade,
        term,
      });
      setMessage('أُرسل الموعد للإدارة — يظهر للطالب وولي الأمر بعد الاعتماد.');
      setTitle('');
      setNotes('');
    } catch (err) {
      if (err?.code === 'TERM_CLOSED' || err?.message === 'TERM_CLOSED') {
        setMessage(`الفصل «${term || err.term || ''}» مقفل من الإدارة — لا يُقبل مواعيد اختبار عليه.`);
      } else {
        setMessage('تعذّر الإرسال.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ErrorBanner>{error && 'تعذّر التحميل.'}</ErrorBanner>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)', lineHeight: 1.7 }}>
        أضف موعد اختبار للصف. بعد اعتماد الإدارة يظهر في بوابة الطالب وولي الأمر.
      </p>

      <form className="card" onSubmit={onSubmit} style={{ gap: 10, maxWidth: 560 }}>
        <div className="card-title" style={{ margin: 0 }}>موعد اختبار جديد</div>
        <div className="field">
          <label>الصف</label>
          <select className="input" value={activeClassId} onChange={(e) => setClassId(e.target.value)}>
            {myClasses.map((c) => <option key={c.id} value={c.id}>{c.title} — {c.subject}</option>)}
          </select>
        </div>
        <div className="field">
          <label>عنوان الاختبار</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="مثال: اختبار شهري — الوحدة 2" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div className="field">
            <label>التاريخ</label>
            <input className="input" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} required dir="ltr" />
          </div>
          <div className="field">
            <label>من</label>
            <input className="input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} dir="ltr" />
          </div>
          <div className="field">
            <label>إلى</label>
            <input className="input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} dir="ltr" />
          </div>
        </div>
        <div className="field">
          <label>الفصل</label>
          <TermSelect value={term} onChange={setTerm} />
        </div>
        {isTermClosed(calendar, term) && (
          <div style={{ fontSize: 13, color: 'var(--color-accent-2-700)' }}>
            هذا الفصل مقفل من الإدارة — لا يمكن إرسال مواعيد اختبار عليه.
          </div>
        )}
        <div className="field">
          <label>ملاحظات</label>
          <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {message && <div style={{ fontSize: 13, color: 'var(--color-accent-700)' }}>{message}</div>}
        <button type="submit" className="btn btn-primary" disabled={busy || !myClasses.length} style={{ width: 'fit-content' }}>
          <Icon name="send" size={14} /> إرسال للاعتماد
        </button>
      </form>

      <div className="card ah-table-wrap" style={{ padding: 0 }}>
        <div className="card-title" style={{ padding: '14px 16px', margin: 0, borderBottom: '1px solid var(--line)' }}>تقويم اختبارات الصف</div>
        <table className="table">
          <thead><tr><th>العنوان</th><th>التاريخ</th><th>الوقت</th><th>الحالة</th></tr></thead>
          <tbody>
            {list.length === 0 && <EmptyRow colSpan={4}>لا مواعيد بعد لهذا الصف.</EmptyRow>}
            {list.map((ex) => (
              <tr key={ex.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{ex.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>{ex.className}</div>
                </td>
                <td className="ah-tabnum">{ex.examDate}</td>
                <td className="ah-tabnum">{[ex.startTime, ex.endTime].filter(Boolean).join(' – ') || '—'}</td>
                <td>
                  <span className={`tag tag-${ex.status === 'معتمد' ? 'accent' : ex.status === 'مرفوض' ? 'neutral' : 'outline'}`}>
                    {ex.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
