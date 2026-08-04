import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { orderBy, where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import BackButton from '../../components/BackButton';
import { EmptyRow, ErrorBanner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useDocOrDemo, useLiveOrDemo } from '../../hooks/useFirestore';
import { useMyStudents } from '../../hooks/useMyStudents';
import {
  demoAttendanceRecords,
  demoGradeEntries,
  demoStudentDetail,
  demoStudents,
} from '../../data/demo';
import { computeAttendanceRate } from '../../lib/attendance';
import { SCHOOL_NAME_AR } from '../../lib/constants';
import {
  ABSENCE_REMINDER_TEMPLATE,
  GENERAL_MESSAGE_TEMPLATE,
  TEACHER_FOLLOWUP_TEMPLATE,
  TEACHER_GRADE_TEMPLATE,
  TEACHER_NOTE_TEMPLATE,
} from '../../lib/phone';
import { relativeFromTimestamp } from '../../lib/relativeTime';
import { guardianWhatsAppTarget, openGuardianWhatsApp } from '../../lib/teacherWhatsApp';
import { scoreToBand } from '../../services/grades';
import { createMeetingRequest } from '../../services/staffRequests';

function demoStudent(id) {
  return demoStudents.find((s) => s.id === id) || null;
}

const ACTIONS = (studentId, classId) => [
  {
    to: `/teacher/attendance?class=${classId || ''}`,
    icon: 'fact_check',
    title: 'حضور وغياب',
    body: 'تسجيل حضور صفّه اليوم.',
  },
  {
    to: `/teacher/students/${studentId}/report`,
    icon: 'print',
    title: 'تقرير للطباعة',
    body: 'حضور + درجات + ملاحظات لولي الأمر.',
  },
  {
    to: `/teacher/attendance-report?class=${classId || ''}`,
    icon: 'analytics',
    title: 'تقرير حضور',
    body: 'ملخص شهري للطباعة.',
  },
  {
    to: `/teacher/grades?class=${classId || ''}`,
    icon: 'grade',
    title: 'رصد درجة',
    body: 'إرسال للاعتماد من الإدارة.',
  },
  {
    to: `/teacher/bulk-grades?class=${classId || ''}`,
    icon: 'grid_view',
    title: 'رصد جماعي',
    body: 'عمود درجات لكل الطلاب.',
  },
  {
    to: `/teacher/grade-sheet?class=${classId || ''}`,
    icon: 'table_chart',
    title: 'كشف درجات',
    body: 'جدول الصف للطباعة.',
  },
  {
    to: `/teacher/observations?class=${classId || ''}&student=${studentId || ''}`,
    icon: 'chat',
    title: 'ملاحظة صفّية',
    body: 'تشجيع أو متابعة سلوك/دراسية.',
  },
  {
    to: `/teacher/follow-up?class=${classId || ''}`,
    icon: 'warning',
    title: 'لوحة المتابعة',
    body: 'غياب متكرر ودرجات منخفضة.',
  },
  {
    to: `/teacher/requests`,
    icon: 'groups',
    title: 'طلب اجتماع ولي أمر',
    body: 'يصل للإدارة من ملف الطالب.',
  },
  {
    to: `/teacher/diary?class=${classId || ''}`,
    icon: 'edit_note',
    title: 'دفتر اليوم',
    body: 'موضوع الحصة والواجب.',
  },
  {
    to: classId ? `/teacher/classes/${classId}` : '/teacher/classes',
    icon: 'school',
    title: 'صفحة الصف',
    body: 'كشف زملاء الصف.',
  },
];

export default function TeacherStudentDetail() {
  const { id } = useParams();
  const { profile } = useAuth();
  const { students, myClasses, demo: rosterDemo } = useMyStudents();
  const roster = students.find((s) => s.studentId === id);
  const primaryClass = roster?.classes?.[0];
  const primaryClassId = primaryClass?.id || '';
  const myClassIds = useMemo(() => new Set(myClasses.map((c) => c.id)), [myClasses]);

  const { data: student, error, demo } = useDocOrDemo(
    id ? `students/${id}` : null,
    demoStudent(id),
  );
  const detail = demoStudentDetail[id];

  const { data: guardians } = useLiveOrDemo(
    id ? `students/${id}/guardians` : '__none__',
    [orderBy('createdAt', 'asc')],
    detail?.guardians || [],
    id,
  );
  const { data: notes } = useLiveOrDemo(
    id ? `students/${id}/notes` : '__none__',
    [orderBy('createdAt', 'desc')],
    detail?.notes || [],
    id,
  );
  const { data: attendance } = useLiveOrDemo(
    id ? `students/${id}/attendanceRecords` : '__none__',
    [orderBy('date', 'desc')],
    demoAttendanceRecords[id] || [],
    id,
  );
  const { data: grades } = useLiveOrDemo(
    'gradeEntries',
    id ? [where('studentId', '==', id), orderBy('createdAt', 'desc')] : [where('studentId', '==', '__none__')],
    demoGradeEntries.filter((g) => g.studentId === id),
    id,
  );

  const myAttendance = useMemo(
    () => (attendance || []).filter((r) => !r.classId || myClassIds.has(r.classId)),
    [attendance, myClassIds],
  );
  const rate = computeAttendanceRate(myAttendance);
  const recentAttendance = myAttendance.slice(0, 12);

  const myGrades = useMemo(
    () => (grades || []).filter((g) => g.teacherId === profile?.id || myClassIds.has(g.classId)),
    [grades, profile?.id, myClassIds],
  );

  const primaryGuardian = (guardians || []).find((g) => g.primary) || (guardians || [])[0];
  const phone = primaryGuardian?.phone
    || student?.guardianPhoneWa
    || student?.guardianPhoneE164
    || student?.guardianPhone
    || student?.guardianPhoneLocal
    || '—';
  const guardianName = primaryGuardian?.name || student?.guardianName || '—';
  const hasWa = !!guardianWhatsAppTarget(student, primaryGuardian);
  const studentName = student?.name || roster?.name || 'الطالب';
  const displayId = student?.displayId || roster?.displayId || '—';
  const gradeLabel = student?.grade || student?.stageLabel || roster?.grade || '—';

  const sendWa = (message) => {
    const ok = openGuardianWhatsApp(student, message, primaryGuardian);
    if (!ok) window.alert('لا يوجد رقم واتساب لولي الأمر. حدّثه من ملف الطالب في الإدارة.');
  };

  const [meetingReason, setMeetingReason] = useState('');
  const [meetingBusy, setMeetingBusy] = useState(false);
  const [meetingMsg, setMeetingMsg] = useState('');

  const requestMeeting = async () => {
    if (!profile?.id || !meetingReason.trim()) {
      setMeetingMsg('اكتب سبب الاجتماع.');
      return;
    }
    if (rosterDemo && !student) {
      setMeetingMsg('وضع العرض: صِل Firebase لإرسال الطلب.');
      return;
    }
    setMeetingBusy(true);
    setMeetingMsg('');
    try {
      await createMeetingRequest({
        teacherId: profile.id,
        teacherName: profile.name,
        studentId: id,
        studentName,
        classId: primaryClassId || null,
        className: primaryClass?.title || '',
        reason: meetingReason,
      });
      setMeetingMsg('أُرسل طلب الاجتماع للإدارة.');
      setMeetingReason('');
    } catch {
      setMeetingMsg('تعذّر الإرسال.');
    } finally {
      setMeetingBusy(false);
    }
  };

  const notInRoster = !roster && !rosterDemo && myClasses.length > 0 && students.length > 0;

  if (!id) return <ErrorBanner>معرّف الطالب غير موجود.</ErrorBanner>;
  if (!student && !roster) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <BackButton to="/teacher/students" label="عودة لكل طلابي" />
        <ErrorBanner>{error || 'تعذّر العثور على هذا الطالب ضمن صفوفك.'}</ErrorBanner>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <BackButton to="/teacher/students" label="عودة لكل طلابي" />
      {notInRoster && (
        <ErrorBanner>هذا الطالب غير مسجّل حالياً في صفوفك — قد تكون البيانات قديمة.</ErrorBanner>
      )}

      {/* Header */}
      <div className="card" style={{ gap: 14 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 14,
              background: 'var(--color-accent-100)',
              color: 'var(--color-accent-800)',
              display: 'grid',
              placeItems: 'center',
              fontFamily: 'var(--font-heading)',
              fontSize: 28,
              flex: 'none',
            }}
          >
            {(student?.initial || studentName).charAt(0)}
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <h2 style={{ margin: 0, fontSize: 24 }}>{studentName}</h2>
            <div style={{ fontSize: 13, color: 'var(--color-neutral-600)', marginTop: 4 }}>
              {[displayId, gradeLabel].filter(Boolean).join(' · ')}
              {demo || rosterDemo ? ' · عرض توضيحي' : ''}
            </div>
            {roster?.classes?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {roster.classes.map((c) => (
                  <Link
                    key={c.id}
                    to={`/teacher/classes/${c.id}`}
                    className="tag tag-accent"
                    style={{ fontSize: 11, textDecoration: 'none' }}
                  >
                    {c.title}{c.subject ? ` · ${c.subject}` : ''}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          <div style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 12 }}>
            <div className="card-kicker">نسبة الحضور</div>
            <div className="ah-tabnum" style={{ fontSize: 26, fontFamily: 'var(--font-heading)' }}>
              {rate == null ? '—' : `${rate}%`}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>{myAttendance.length} يوم مسجّل</div>
          </div>
          <div style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 12 }}>
            <div className="card-kicker">درجاتي له</div>
            <div className="ah-tabnum" style={{ fontSize: 26, fontFamily: 'var(--font-heading)' }}>{myGrades.length}</div>
            <div style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>
              {myGrades.filter((g) => g.status === 'معتمد').length} معتمدة
            </div>
          </div>
          <div style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 12 }}>
            <div className="card-kicker">ملاحظات</div>
            <div className="ah-tabnum" style={{ fontSize: 26, fontFamily: 'var(--font-heading)' }}>{(notes || []).length}</div>
            <div style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>في ملف الطالب</div>
          </div>
          <div style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 12 }}>
            <div className="card-kicker">ولي الأمر</div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{guardianName}</div>
            <div className="ah-tabnum" style={{ fontSize: 12 }} dir="ltr">{phone}</div>
          </div>
        </div>
      </div>

      {/* Actions hub */}
      <div className="card" style={{ gap: 12 }}>
        <div className="card-title" style={{ margin: 0 }}>كل الإجراءات من هنا</div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-neutral-600)', lineHeight: 1.6 }}>
          اختصارات مباشرة لصلاحياتك كمعلّم لهذا الطالب — الحضور، الدرجات، الملاحظات، المتابعة، وواتساب ولي الأمر.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {ACTIONS(id, primaryClassId).map((a) => (
            <Link
              key={a.to + a.title}
              to={a.to}
              className="card"
              style={{
                textDecoration: 'none',
                color: 'inherit',
                padding: 14,
                gap: 6,
                border: '1px solid var(--line)',
                boxShadow: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name={a.icon} size={18} color="var(--gold)" />
                <strong style={{ fontSize: 14 }}>{a.title}</strong>
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-neutral-600)', lineHeight: 1.5 }}>{a.body}</div>
            </Link>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ fontSize: 13 }}
            disabled={!hasWa}
            onClick={() => sendWa(GENERAL_MESSAGE_TEMPLATE(SCHOOL_NAME_AR, guardianName))}
          >
            <Icon name="chat" size={15} /> واتساب ولي الأمر
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: 13 }}
            disabled={!hasWa}
            onClick={() => sendWa(ABSENCE_REMINDER_TEMPLATE(SCHOOL_NAME_AR, studentName, ''))}
          >
            تنبيه غياب
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: 13 }}
            disabled={!hasWa}
            onClick={() => sendWa(TEACHER_FOLLOWUP_TEMPLATE(
              SCHOOL_NAME_AR,
              profile?.name,
              studentName,
              rate != null && rate < 75 ? `نسبة الحضور الحالية ${rate}%.` : 'نرجو المتابعة الأكاديمية.',
            ))}
          >
            رسالة متابعة
          </button>
          <Link
            to={`/teacher/students/${id}/report`}
            className="btn btn-secondary"
            style={{ fontSize: 13, textDecoration: 'none' }}
          >
            <Icon name="print" size={15} /> تقرير للطباعة
          </Link>
          {!hasWa && (
            <span style={{ fontSize: 12, color: 'var(--color-neutral-500)', alignSelf: 'center' }}>
              لا رقم واتساب — تحدّثه الإدارة من ملف الطالب.
            </span>
          )}
        </div>

        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="card-title" style={{ margin: 0, fontSize: 14 }}>أحتاج اجتماعاً مع ولي الأمر</div>
          <textarea
            className="input"
            rows={2}
            value={meetingReason}
            onChange={(e) => setMeetingReason(e.target.value)}
            placeholder="سبب الاجتماع للإدارة…"
          />
          <button type="button" className="btn btn-primary" style={{ width: 'fit-content', fontSize: 13 }} disabled={meetingBusy} onClick={requestMeeting}>
            <Icon name="send" size={14} /> إرسال للإدارة
          </button>
          {meetingMsg && <div style={{ fontSize: 12, color: 'var(--color-accent-700)' }}>{meetingMsg}</div>}
        </div>
      </div>

      {/* Grades */}
      <div className="card ah-table-wrap" style={{ padding: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="card-title" style={{ margin: 0 }}>الدرجات</div>
          <Link
            to={`/teacher/grades?class=${primaryClassId}`}
            className="btn btn-ghost"
            style={{ fontSize: 12, marginInlineStart: 'auto', textDecoration: 'none' }}
          >
            رصد درجة جديدة
          </Link>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>التقييم</th>
              <th>الصف</th>
              <th>الدرجة</th>
              <th>الحالة</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {myGrades.length === 0 && <EmptyRow colSpan={5}>لا درجات مرصودة لهذا الطالب من صفوفك.</EmptyRow>}
            {myGrades.slice(0, 20).map((g) => (
              <tr key={g.id}>
                <td>
                  {g.assessmentTitle}
                  <div style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>
                    {[g.assessmentType, g.term].filter(Boolean).join(' · ')}
                  </div>
                </td>
                <td style={{ fontSize: 13 }}>{g.className || '—'}</td>
                <td className="ah-tabnum">
                  {g.score}/{g.maxScore}
                  <div style={{ fontSize: 10, color: 'var(--color-neutral-500)' }}>{scoreToBand(g.score, g.maxScore)}</div>
                </td>
                <td>
                  <span className={`tag tag-${g.status === 'معتمد' ? 'accent' : g.status === 'مرفوض' ? 'neutral' : 'outline'}`}>
                    {g.status}
                  </span>
                </td>
                <td style={{ textAlign: 'left' }}>
                  {hasWa && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ fontSize: 11 }}
                      onClick={() => sendWa(TEACHER_GRADE_TEMPLATE(
                        SCHOOL_NAME_AR,
                        profile?.name,
                        studentName,
                        g.assessmentTitle,
                        `${g.score}/${g.maxScore}`,
                      ))}
                    >
                      واتساب
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Notes */}
      <div className="card" style={{ gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="card-title" style={{ margin: 0 }}>الملاحظات</div>
          <Link
            to={`/teacher/observations?class=${primaryClassId}&student=${id}`}
            className="btn btn-ghost"
            style={{ fontSize: 12, marginInlineStart: 'auto', textDecoration: 'none' }}
          >
            إضافة ملاحظة
          </Link>
        </div>
        {(notes || []).length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>لا ملاحظات بعد.</div>
        )}
        <div style={{ display: 'grid', gap: 8 }}>
          {(notes || []).slice(0, 10).map((n) => (
            <div
              key={n.id || `${n.kind}-${(n.note || '').slice(0, 12)}`}
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                border: '1px solid var(--line)',
                fontSize: 13,
                lineHeight: 1.65,
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>
                  {[n.kind, n.sentiment, relativeFromTimestamp(n.createdAt)].filter(Boolean).join(' · ')}
                </span>
                {hasWa && n.note && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: 11, padding: '2px 8px', marginInlineStart: 'auto' }}
                    onClick={() => sendWa(TEACHER_NOTE_TEMPLATE(SCHOOL_NAME_AR, profile?.name, studentName, n.note))}
                  >
                    واتساب
                  </button>
                )}
              </div>
              {n.note || n.body || '—'}
            </div>
          ))}
        </div>
      </div>

      {/* Attendance */}
      <div className="card ah-table-wrap" style={{ padding: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="card-title" style={{ margin: 0 }}>آخر الحضور</div>
          <Link
            to={`/teacher/attendance?class=${primaryClassId}`}
            className="btn btn-ghost"
            style={{ fontSize: 12, marginInlineStart: 'auto', textDecoration: 'none' }}
          >
            تسجيل حضور
          </Link>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>الصف</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {recentAttendance.length === 0 && <EmptyRow colSpan={3}>لا سجلات حضور في صفوفك بعد.</EmptyRow>}
            {recentAttendance.map((r, i) => (
              <tr key={`${r.date}-${r.classId}-${i}`}>
                <td className="ah-tabnum">{r.date}</td>
                <td style={{ fontSize: 13 }}>{r.className || r.subject || '—'}</td>
                <td>
                  <span className={`tag tag-${r.status === 'حاضر' ? 'accent' : r.status === 'غائب' ? 'accent-2' : 'neutral'}`}>
                    {r.status}
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
