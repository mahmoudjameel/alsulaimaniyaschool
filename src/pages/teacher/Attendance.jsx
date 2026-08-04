import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { orderBy } from 'firebase/firestore';
import Icon from '../../components/Icon';
import SearchInput from '../../components/SearchInput';
import { ErrorBanner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useDocOrDemo, useLiveOrDemo } from '../../hooks/useFirestore';
import { useMyClasses } from '../../hooks/useMyClasses';
import { demoEnrollments, demoStudents } from '../../data/demo';
import { ATTENDANCE_STATUSES } from '../../lib/attendance';
import { SCHOOL_NAME_AR } from '../../lib/constants';
import { ABSENCE_REMINDER_TEMPLATE } from '../../lib/phone';
import { openGuardianWhatsApp } from '../../lib/teacherWhatsApp';
import { submitAttendance } from '../../services/attendance';
import { saveAttendanceTemplate } from '../../services/homework';
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
  const [lastAbsentees, setLastAbsentees] = useState([]);
  const [tmplMsg, setTmplMsg] = useState('');

  const { data: studentsDir } = useLiveOrDemo('students', [orderBy('name', 'asc')], demoStudents);

  const yesterdayStr = useMemo(() => {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, [date]);

  const { data: yesterdaySession } = useDocOrDemo(
    activeClassId ? `classes/${activeClassId}/attendanceSessions/${yesterdayStr}` : null,
    null,
  );
  const { data: attendanceTemplate } = useDocOrDemo(
    activeClassId ? `classes/${activeClassId}/attendanceTemplates/default` : null,
    null,
  );

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

  const applyRecordsMap = (records) => {
    if (!records) return false;
    const next = {};
    for (const s of enrolled) {
      const sid = s.studentId || s.id;
      next[sid] = records[sid]?.status || 'حاضر';
    }
    setStatuses(next);
    return true;
  };

  const copyYesterday = () => {
    if (!yesterdaySession?.records) {
      setTmplMsg(`لا يوجد حضور محفوظ لتاريخ ${yesterdayStr}.`);
      return;
    }
    applyRecordsMap(yesterdaySession.records);
    setTmplMsg(`تم نسخ حضور أمس (${yesterdayStr}) — راجع ثم احفظ.`);
  };

  const applyTemplate = () => {
    if (!attendanceTemplate?.records) {
      setTmplMsg('لا نموذج محفوظ لهذا الصف بعد.');
      return;
    }
    applyRecordsMap(attendanceTemplate.records);
    setTmplMsg('تم تطبيق النموذج المحفوظ — راجع ثم احفظ.');
  };

  const saveTemplate = async () => {
    if (demo || classesDemo || !activeClass || !profile?.id) {
      setTmplMsg('وضع العرض: صِل Firebase لحفظ النموذج.');
      return;
    }
    const records = {};
    for (const s of enrolled) {
      const sid = s.studentId || s.id;
      records[sid] = { studentName: s.studentName || s.name, status: statuses[sid] || 'حاضر' };
    }
    try {
      await saveAttendanceTemplate({
        classId: activeClassId,
        teacherId: profile.id,
        teacherName: profile.name,
        records,
      });
      setTmplMsg('حُفظ نموذج الحضور لهذا الصف.');
    } catch {
      setTmplMsg('تعذّر حفظ النموذج.');
    }
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
      const absentees = enrolled
        .filter((s) => (statuses[s.studentId || s.id] || 'حاضر') === 'غائب')
        .map((s) => ({
          studentId: s.studentId || s.id,
          studentName: s.studentName || s.name,
        }));
      setLastAbsentees(absentees);
      setMessage(absentees.length
        ? `تمّ حفظ الحضور · ${absentees.length} غائب — يمكنك إبلاغ أولياء الأمور أدناه.`
        : 'تمّ حفظ الحضور.');
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
          <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={copyYesterday}>نفس أمس</button>
          <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={applyTemplate}>نموذج الصف</button>
          <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={saveTemplate}>حفظ كنموذج</button>
        </div>
        {tmplMsg && <div style={{ fontSize: 12, color: 'var(--color-accent-700)', marginTop: 8 }}>{tmplMsg}</div>}
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
          <Link to={`/teacher/follow-up?class=${activeClassId}`} className="btn btn-secondary" style={{ textDecoration: 'none', fontSize: 13 }}>
            متابعة الطلاب
          </Link>
        </div>

        {lastAbsentees.length > 0 && (
          <div style={{ marginTop: 16, padding: 12, border: '1px solid var(--line)', borderRadius: 12 }}>
            <div className="card-title" style={{ fontSize: 14, marginBottom: 8 }}>إبلاغ أولياء الغائبين (واتساب)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lastAbsentees.map((a) => {
                const st = (studentsDir || []).find((s) => s.id === a.studentId);
                return (
                  <div key={a.studentId} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ flex: 1, fontSize: 13 }}>{a.studentName}</span>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: 12 }}
                      onClick={() => {
                        const ok = openGuardianWhatsApp(
                          st,
                          ABSENCE_REMINDER_TEMPLATE(SCHOOL_NAME_AR, a.studentName, date),
                        );
                        if (!ok) window.alert('لا رقم واتساب مسجّل لهذا الطالب.');
                      }}
                    >
                      <Icon name="chat" size={13} /> واتساب
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
