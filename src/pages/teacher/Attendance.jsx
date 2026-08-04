import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { orderBy } from 'firebase/firestore';
import Icon from '../../components/Icon';
import SearchInput from '../../components/SearchInput';
import { ErrorBanner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useDocOrDemo, useLiveOrDemo } from '../../hooks/useFirestore';
import { useMyClasses } from '../../hooks/useMyClasses';
import { demoEnrollments } from '../../data/demo';
import { ATTENDANCE_STATUSES } from '../../lib/attendance';
import { submitAttendance } from '../../services/attendance';
import { filterByStudentSearch } from '../../lib/studentSearch';

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function Attendance() {
  const { profile } = useAuth();
  const [params] = useSearchParams();
  const { myClasses, error, demo: classesDemo } = useMyClasses();
  const [classId, setClassId] = useState(params.get('class') || '');
  const activeClassId = classId || myClasses[0]?.id || '';
  const activeClass = myClasses.find((c) => c.id === activeClassId);
  const [date, setDate] = useState(todayStr());
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fromUrl = params.get('class');
    if (fromUrl) setClassId(fromUrl);
  }, [params]);

  const { data: enrolled } = useLiveOrDemo(
    activeClassId ? `classes/${activeClassId}/enrollments` : '__none__',
    [orderBy('enrolledAt', 'asc')],
    demoEnrollments[activeClassId] || []
  );
  const enrolledView = useMemo(() => filterByStudentSearch(enrolled, search), [enrolled, search]);

  const { data: existingSession, demo } = useDocOrDemo(
    activeClassId ? `classes/${activeClassId}/attendanceSessions/${date}` : null,
    null
  );

  const [statuses, setStatuses] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const base = {};
    for (const s of enrolled) {
      const sid = s.studentId || s.id;
      base[sid] = existingSession?.records?.[sid]?.status || 'حاضر';
    }
    setStatuses(base);
    setMessage('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClassId, date, enrolled.length, existingSession]);

  const setAll = (status) => {
    const next = {};
    for (const s of enrolled) next[s.studentId || s.id] = status;
    setStatuses(next);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (demo || classesDemo) { setMessage('وضع العرض التوضيحي: صِل مشروع Firebase لحفظ الحضور فعلياً.'); return; }
    if (!activeClass) return;
    setSubmitting(true);
    setMessage('');
    try {
      await submitAttendance({
        classId: activeClassId, className: activeClass.title, subject: activeClass.subject,
        teacherId: profile.id, teacherName: profile.name, shift: activeClass.shift, date,
        records: enrolled.map((s) => {
          const sid = s.studentId || s.id;
          return { studentId: sid, studentName: s.studentName || s.name, status: statuses[sid] || 'حاضر' };
        }),
        takenByName: profile.name,
      });
      setMessage('تمّ حفظ الحضور.');
    } catch {
      setMessage('تعذّر حفظ الحضور. حاول مجدداً.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ErrorBanner>{error && 'تعذّر تحميل الصفوف.'}</ErrorBanner>
      <form className="card" onSubmit={onSubmit}>
        <div className="card-title" style={{ marginBottom: 8 }}>تسجيل الحضور والغياب</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 1, minWidth: 220 }}>
            <label>الصف</label>
            <select className="input" value={activeClassId} onChange={(e) => { setClassId(e.target.value); setSearch(''); }}>
              {myClasses.length === 0 && <option value="">لا يوجد صفوف مسندة إليك</option>}
              {myClasses.map((c) => <option key={c.id} value={c.id}>{c.title} — {c.subject}{c.grade ? ` · ${c.grade}` : ''}</option>)}
            </select>
          </div>
          <div className="field" style={{ minWidth: 170 }}>
            <label>التاريخ</label>
            <input className="input" type="date" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} max={todayStr()} />
          </div>
          <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setAll('حاضر')}>تحديد الكل حاضر</button>
        </div>
        <div style={{ marginTop: 12 }}>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="بحث سريع عن طالب بالاسم أو الرقم…"
            style={{ maxWidth: 420 }}
          />
        </div>

        {existingSession && (
          <div style={{ fontSize: 12, color: 'var(--gold)', marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="info" size={14} /> تمّ تسجيل حضور هذا اليوم مسبقاً بواسطة {existingSession.takenByName} — يمكنك التعديل وإعادة الحفظ.
          </div>
        )}

        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {enrolled.length === 0 && <div style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>لا يوجد طلاب مسجّلون في هذا الصف.</div>}
          {enrolled.length > 0 && enrolledView.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>لا طلاب مطابقون للبحث.</div>
          )}
          {enrolledView.map((s) => {
            const sid = s.studentId || s.id;
            return (
              <div key={sid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', flexWrap: 'wrap' }}>
                <span style={{ flex: 1, fontSize: 14 }}>
                  {s.studentName || s.name}
                  {s.displayId ? <span className="ah-tabnum" style={{ marginInlineStart: 8, fontSize: 11, color: 'var(--color-neutral-500)' }}>{s.displayId}</span> : null}
                </span>
                <div className="seg">
                  {ATTENDANCE_STATUSES.map((st) => (
                    <label key={st} className="seg-opt">
                      <input type="radio" name={`status-${sid}`} checked={(statuses[sid] || 'حاضر') === st} onChange={() => setStatuses((prev) => ({ ...prev, [sid]: st }))} />
                      <span>{st}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {message && <div style={{ fontSize: 13, color: 'var(--color-accent-700)', marginTop: 10 }}>{message}</div>}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
          <button type="submit" className="btn btn-primary" disabled={submitting || enrolled.length === 0}>
            <Icon name="fact_check" size={15} /> {submitting ? 'جارٍ الحفظ…' : 'حفظ الحضور'}
          </button>
          <Link to={`/teacher/attendance-report?class=${activeClassId}`} className="btn btn-secondary" style={{ textDecoration: 'none', fontSize: 13 }}>
            تقرير شهري
          </Link>
        </div>
      </form>
    </div>
  );
}
