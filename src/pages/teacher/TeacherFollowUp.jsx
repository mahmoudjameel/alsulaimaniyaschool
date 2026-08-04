import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { orderBy, where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import SearchInput from '../../components/SearchInput';
import { EmptyRow, ErrorBanner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useMyClasses } from '../../hooks/useMyClasses';
import { useDocOrDemo, useLiveOrDemo } from '../../hooks/useFirestore';
import { demoEnrollments, demoAttendanceSessions, demoStudents } from '../../data/demo';
import { SCHOOL_NAME_AR } from '../../lib/constants';
import { TEACHER_FOLLOWUP_TEMPLATE } from '../../lib/phone';
import { openGuardianWhatsApp } from '../../lib/teacherWhatsApp';
import { filterByStudentSearch } from '../../lib/studentSearch';

function monthKey() {
  return new Date().toISOString().slice(0, 7);
}

function buildFollowUpRows({ enrolled, sessions, grades, observations, classId, classTitle }) {
  const month = monthKey();
  const monthSessions = (sessions || []).filter((s) => (s.date || s.id || '').startsWith(month));

  return (enrolled || []).map((s) => {
    const sid = s.studentId || s.id;
    let present = 0;
    let absent = 0;
    let late = 0;
    let total = 0;
    for (const session of monthSessions) {
      const rec = session.records?.[sid];
      if (!rec) continue;
      total += 1;
      if (rec.status === 'حاضر') present += 1;
      else if (rec.status === 'غائب') absent += 1;
      else if (rec.status === 'متأخر') late += 1;
    }
    const pct = total ? Math.round(((present + late) / total) * 100) : null;

    const studentGrades = (grades || []).filter((g) => g.studentId === sid && g.classId === classId);
    const lowGrades = studentGrades.filter((g) => {
      const max = Number(g.maxScore) || 0;
      if (!max) return false;
      return (Number(g.score) / max) * 100 < 60;
    });

    const notes = (observations || []).filter((o) => o.studentId === sid && (!o.classId || o.classId === classId));
    const followNotes = notes.filter((o) => o.sentiment && o.sentiment !== 'إيجابي');

    const reasons = [];
    if (absent >= 3) reasons.push(`غياب ${absent} أيام هذا الشهر`);
    if (pct != null && pct < 75 && total >= 4) reasons.push(`نسبة حضور ${pct}%`);
    if (lowGrades.length) reasons.push(`${lowGrades.length} درجة منخفضة`);
    if (followNotes.length) reasons.push(`${followNotes.length} ملاحظة متابعة`);

    return {
      studentId: sid,
      name: s.studentName || s.name,
      displayId: s.displayId || '—',
      classId,
      classTitle,
      absent,
      pct,
      lowGrades: lowGrades.length,
      reasons,
      atRisk: reasons.length > 0,
      priority: absent * 3 + lowGrades.length * 2 + followNotes.length + (pct != null && pct < 75 ? 2 : 0),
    };
  }).filter((r) => r.atRisk).sort((a, b) => b.priority - a.priority || String(a.name).localeCompare(String(b.name), 'ar'));
}

function FollowUpWhatsAppButton({ studentId, studentName, reasons, teacherName }) {
  const { data: student } = useDocOrDemo(
    studentId ? `students/${studentId}` : null,
    demoStudents.find((s) => s.id === studentId) || null,
  );

  const onClick = () => {
    const text = TEACHER_FOLLOWUP_TEMPLATE(SCHOOL_NAME_AR, teacherName, studentName, reasons.join('؛ '));
    const ok = openGuardianWhatsApp(student, text);
    if (!ok) window.alert('لا يوجد رقم واتساب لولي الأمر مسجّل لهذا الطالب. حدّثه من الإدارة.');
  };

  return (
    <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={onClick}>
      <Icon name="chat" size={13} /> واتساب
    </button>
  );
}

export default function TeacherFollowUp() {
  const { profile } = useAuth();
  const [params] = useSearchParams();
  const { myClasses, error, demo } = useMyClasses();
  const [classId, setClassId] = useState(params.get('class') || '');
  const activeClassId = classId || myClasses[0]?.id || '';
  const activeClass = myClasses.find((c) => c.id === activeClassId);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fromUrl = params.get('class');
    if (fromUrl) setClassId(fromUrl);
  }, [params]);

  const { data: enrolled } = useLiveOrDemo(
    activeClassId ? `classes/${activeClassId}/enrollments` : '__none__',
    [orderBy('enrolledAt', 'asc')],
    demoEnrollments[activeClassId] || [],
    activeClassId,
  );

  const demoSessions = useMemo(() => {
    const raw = demoAttendanceSessions?.[activeClassId] || [];
    return raw.map((s, i) => ({ id: s.date || `d-${i}`, ...s }));
  }, [activeClassId]);

  const { data: sessions } = useLiveOrDemo(
    activeClassId ? `classes/${activeClassId}/attendanceSessions` : '__none__',
    [orderBy('date', 'desc')],
    demoSessions,
    activeClassId,
  );

  const { data: grades } = useLiveOrDemo(
    'gradeEntries',
    [where('teacherId', '==', profile?.id || '__none__'), orderBy('createdAt', 'desc')],
    [],
    profile?.id,
  );

  const { data: observations } = useLiveOrDemo(
    'observations',
    [where('teacherId', '==', profile?.id || '__none__'), orderBy('createdAt', 'desc')],
    [],
    profile?.id,
  );

  const rows = useMemo(
    () => buildFollowUpRows({
      enrolled,
      sessions,
      grades,
      observations,
      classId: activeClassId,
      classTitle: activeClass?.title,
    }),
    [enrolled, sessions, grades, observations, activeClassId, activeClass?.title],
  );

  const view = useMemo(() => filterByStudentSearch(rows, search), [rows, search]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ErrorBanner>{error && 'تعذّر تحميل المتابعة.'}</ErrorBanner>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)', lineHeight: 1.7 }}>
        طلاب يحتاجون متابعة هذا الشهر: غياب متكرر، حضور منخفض، درجات ضعيفة، أو ملاحظات متابعة.
        {demo ? ' (عرض توضيحي)' : ''}
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
        <div className="field" style={{ minWidth: 220, flex: 1 }}>
          <label>الصف</label>
          <select className="input" value={activeClassId} onChange={(e) => { setClassId(e.target.value); setSearch(''); }}>
            {myClasses.length === 0 && <option value="">لا صفوف</option>}
            {myClasses.map((c) => (
              <option key={c.id} value={c.id}>{c.title} — {c.subject}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 200, maxWidth: 320 }}>
          <SearchInput value={search} onChange={setSearch} placeholder="بحث عن طالب…" />
        </div>
        <Link to={`/teacher/attendance-report?class=${activeClassId}`} className="btn btn-secondary" style={{ textDecoration: 'none', fontSize: 13 }}>
          تقرير حضور
        </Link>
        <Link to={`/teacher/grade-sheet?class=${activeClassId}`} className="btn btn-secondary" style={{ textDecoration: 'none', fontSize: 13 }}>
          كشف درجات
        </Link>
      </div>

      <div className="ah-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12 }}>
        <div className="card">
          <span className="card-kicker">يحتاجون متابعة</span>
          <div className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 28, color: 'var(--gold)' }}>{rows.length}</div>
        </div>
        <div className="card">
          <span className="card-kicker">غياب ≥ 3</span>
          <div className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 28 }}>{rows.filter((r) => r.absent >= 3).length}</div>
        </div>
        <div className="card">
          <span className="card-kicker">درجات منخفضة</span>
          <div className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 28 }}>{rows.filter((r) => r.lowGrades > 0).length}</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="ah-table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>الطالب</th>
                <th>أسباب المتابعة</th>
                <th>حضور الشهر</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {view.length === 0 && (
                <EmptyRow colSpan={4}>
                  {search ? 'لا نتائج.' : 'لا طلاب ضمن معايير المتابعة لهذا الصف حالياً.'}
                </EmptyRow>
              )}
              {view.map((r) => (
                <tr key={r.studentId}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.name}</div>
                    <div className="ah-tabnum" style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>{r.displayId}</div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {r.reasons.map((reason) => (
                        <span key={reason} className="tag tag-neutral" style={{ fontSize: 11 }}>{reason}</span>
                      ))}
                    </div>
                  </td>
                  <td className="ah-tabnum">
                    {r.pct == null ? '—' : `${r.pct}%`}
                    <span style={{ color: 'var(--color-neutral-500)', fontSize: 11 }}> · غياب {r.absent}</span>
                  </td>
                  <td style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>
                    <Link
                      to={`/teacher/students/${r.studentId}`}
                      className="btn btn-primary"
                      style={{ fontSize: 12, textDecoration: 'none' }}
                    >
                      ملف
                    </Link>
                    <FollowUpWhatsAppButton
                      studentId={r.studentId}
                      studentName={r.name}
                      reasons={r.reasons}
                      teacherName={profile?.name}
                    />
                    <Link to={`/teacher/observations?class=${activeClassId}&student=${r.studentId}`} className="btn btn-ghost" style={{ fontSize: 12, textDecoration: 'none' }}>
                      ملاحظة
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
