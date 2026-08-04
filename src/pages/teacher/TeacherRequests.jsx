import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { orderBy, where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { EmptyRow, ErrorBanner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useMyClasses } from '../../hooks/useMyClasses';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { createCoverRequest, createMeetingRequest } from '../../services/staffRequests';

export default function TeacherRequests() {
  const { profile } = useAuth();
  const { myClasses, demo, error } = useMyClasses();
  const { data: myRequests } = useLiveOrDemo(
    'staffRequests',
    [where('teacherId', '==', profile?.id || '__none__'), orderBy('createdAt', 'desc')],
    [],
    profile?.id,
  );

  const meetings = useMemo(() => (myRequests || []).filter((r) => r.kind === 'meeting'), [myRequests]);
  const covers = useMemo(() => (myRequests || []).filter((r) => r.kind === 'cover'), [myRequests]);

  const [tab, setTab] = useState('meeting');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  // Meeting form
  const [mClassId, setMClassId] = useState('');
  const [mStudentName, setMStudentName] = useState('');
  const [mStudentId, setMStudentId] = useState('');
  const [mReason, setMReason] = useState('');
  const [mTime, setMTime] = useState('');

  // Cover form
  const [cClassId, setCClassId] = useState('');
  const [cDate, setCDate] = useState(new Date().toISOString().slice(0, 10));
  const [cPeriod, setCPeriod] = useState('');
  const [cReason, setCReason] = useState('غياب معلّم');
  const [cNote, setCNote] = useState('');

  const activeMeetingClass = myClasses.find((c) => c.id === (mClassId || myClasses[0]?.id));
  const activeCoverClass = myClasses.find((c) => c.id === (cClassId || myClasses[0]?.id));

  const { data: enrolled } = useLiveOrDemo(
    activeMeetingClass?.id ? `classes/${activeMeetingClass.id}/enrollments` : '__none__',
    [orderBy('enrolledAt', 'asc')],
    [],
    activeMeetingClass?.id,
  );

  const submitMeeting = async (e) => {
    e.preventDefault();
    if (demo) { setMessage('وضع العرض: صِل Firebase.'); return; }
    if (!activeMeetingClass || !mStudentId || !mReason.trim()) return;
    setBusy(true);
    setMessage('');
    try {
      await createMeetingRequest({
        teacherId: profile.id,
        teacherName: profile.name,
        studentId: mStudentId,
        studentName: mStudentName,
        classId: activeMeetingClass.id,
        className: activeMeetingClass.title,
        reason: mReason,
        preferredTime: mTime,
      });
      setMessage('أُرسل طلب الاجتماع للإدارة.');
      setMReason('');
      setMTime('');
      setMStudentId('');
      setMStudentName('');
    } catch {
      setMessage('تعذّر إرسال الطلب.');
    } finally {
      setBusy(false);
    }
  };

  const submitCover = async (e) => {
    e.preventDefault();
    if (demo) { setMessage('وضع العرض: صِل Firebase.'); return; }
    if (!activeCoverClass || !cReason.trim()) return;
    setBusy(true);
    setMessage('');
    try {
      await createCoverRequest({
        teacherId: profile.id,
        teacherName: profile.name,
        classId: activeCoverClass.id,
        className: activeCoverClass.title,
        date: cDate,
        periodLabel: cPeriod,
        reason: cReason,
        note: cNote,
      });
      setMessage('أُرسل طلب التغطية للإدارة والاستقبال.');
      setCNote('');
    } catch {
      setMessage('تعذّر إرسال الطلب.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ErrorBanner>{error && 'تعذّر التحميل.'}</ErrorBanner>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)', lineHeight: 1.7 }}>
        طلب اجتماع مع ولي الأمر يصل للإدارة، وطلب تغطية/استبدال حصة يُبلَّغ للإدارة والاستقبال.
      </p>

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className={`btn ${tab === 'meeting' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('meeting')}>
          اجتماع ولي أمر
        </button>
        <button type="button" className={`btn ${tab === 'cover' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('cover')}>
          تغطية / استبدال
        </button>
      </div>

      {message && <div style={{ fontSize: 13, color: 'var(--color-accent-700)' }}>{message}</div>}

      {tab === 'meeting' && (
        <form className="card" onSubmit={submitMeeting} style={{ gap: 10, maxWidth: 560 }}>
          <div className="card-title" style={{ margin: 0 }}>أحتاج اجتماعاً مع ولي الأمر</div>
          <div className="field">
            <label>الصف</label>
            <select className="input" value={activeMeetingClass?.id || ''} onChange={(e) => { setMClassId(e.target.value); setMStudentId(''); }}>
              {myClasses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div className="field">
            <label>الطالب</label>
            <select
              className="input"
              value={mStudentId}
              required
              onChange={(e) => {
                const sid = e.target.value;
                const s = (enrolled || []).find((x) => (x.studentId || x.id) === sid);
                setMStudentId(sid);
                setMStudentName(s?.studentName || s?.name || '');
              }}
            >
              <option value="">اختر…</option>
              {(enrolled || []).map((s) => (
                <option key={s.studentId || s.id} value={s.studentId || s.id}>{s.studentName || s.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>سبب الاجتماع</label>
            <textarea className="input" rows={3} value={mReason} onChange={(e) => setMReason(e.target.value)} required />
          </div>
          <div className="field">
            <label>وقت مقترح (اختياري)</label>
            <input className="input" value={mTime} onChange={(e) => setMTime(e.target.value)} placeholder="مثال: بعد الظهر يوم الأحد" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy} style={{ width: 'fit-content' }}>
            <Icon name="send" size={14} /> إرسال للإدارة
          </button>
          <div style={{ fontSize: 12 }}>
            أو من <Link to="/teacher/students">ملف الطالب</Link> مباشرة.
          </div>
        </form>
      )}

      {tab === 'cover' && (
        <form className="card" onSubmit={submitCover} style={{ gap: 10, maxWidth: 560 }}>
          <div className="card-title" style={{ margin: 0 }}>طلب تغطية أو استبدال حصة</div>
          <div className="field">
            <label>الصف</label>
            <select className="input" value={activeCoverClass?.id || ''} onChange={(e) => setCClassId(e.target.value)}>
              {myClasses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="field">
              <label>التاريخ</label>
              <input className="input" type="date" value={cDate} onChange={(e) => setCDate(e.target.value)} dir="ltr" required />
            </div>
            <div className="field">
              <label>الحصة / الفترة</label>
              <input className="input" value={cPeriod} onChange={(e) => setCPeriod(e.target.value)} placeholder="الحصة 3" />
            </div>
          </div>
          <div className="field">
            <label>السبب</label>
            <select className="input" value={cReason} onChange={(e) => setCReason(e.target.value)}>
              <option>غياب معلّم</option>
              <option>ظرف طارئ</option>
              <option>تبادل حصص</option>
              <option>أخرى</option>
            </select>
          </div>
          <div className="field">
            <label>ملاحظة</label>
            <textarea className="input" rows={2} value={cNote} onChange={(e) => setCNote(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy} style={{ width: 'fit-content' }}>
            <Icon name="send" size={14} /> إرسال
          </button>
        </form>
      )}

      <div className="card ah-table-wrap" style={{ padding: 0 }}>
        <div className="card-title" style={{ padding: '14px 16px', margin: 0, borderBottom: '1px solid var(--line)' }}>
          طلباتي · اجتماعات {meetings.length} · تغطية {covers.length}
        </div>
        <table className="table">
          <thead><tr><th>النوع</th><th>التفاصيل</th><th>الحالة</th></tr></thead>
          <tbody>
            {(myRequests || []).length === 0 && <EmptyRow colSpan={3}>لا طلبات بعد.</EmptyRow>}
            {(myRequests || []).map((r) => (
              <tr key={r.id}>
                <td>{r.kind === 'meeting' ? 'اجتماع' : 'تغطية'}</td>
                <td>
                  {r.kind === 'meeting'
                    ? `${r.studentName} — ${r.reason}`
                    : `${r.className} · ${r.date} — ${r.reason}`}
                </td>
                <td><span className={`tag tag-${r.status === 'مقبول' || r.status === 'تمّ' ? 'accent' : 'outline'}`}>{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
