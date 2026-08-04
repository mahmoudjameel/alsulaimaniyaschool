import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { orderBy, where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import Logo from '../../components/Logo';
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
import { CURRENT_ACADEMIC_YEAR, SCHOOL_NAME_AR } from '../../lib/constants';
import { scoreToBand } from '../../services/grades';

export default function TeacherStudentReport() {
  const { id } = useParams();
  const { profile } = useAuth();
  const { students, myClasses } = useMyStudents();
  const roster = students.find((s) => s.studentId === id);
  const myClassIds = useMemo(() => new Set(myClasses.map((c) => c.id)), [myClasses]);

  const { data: student, error, demo } = useDocOrDemo(
    id ? `students/${id}` : null,
    demoStudents.find((s) => s.id === id) || null,
  );
  const detail = demoStudentDetail[id];

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
  const approvedGrades = useMemo(
    () => (grades || []).filter((g) => g.status === 'معتمد' && (g.teacherId === profile?.id || myClassIds.has(g.classId))),
    [grades, profile?.id, myClassIds],
  );
  const visibleNotes = useMemo(
    () => (notes || []).filter((n) => n.visibleToParent !== false).slice(0, 15),
    [notes],
  );

  const name = student?.name || roster?.name || 'الطالب';

  if (!student && !roster) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <BackButton to="/teacher/students" label="عودة" />
        <ErrorBanner>{error || 'الطالب غير موجود.'}</ErrorBanner>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="no-print" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <BackButton to={`/teacher/students/${id}`} label="عودة لملف الطالب" />
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          <Icon name="print" size={15} /> طباعة / PDF
        </button>
      </div>

      <div className="card print-page" style={{ gap: 16, padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Logo size={48} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{SCHOOL_NAME_AR}</div>
              <div style={{ fontSize: 13, color: 'var(--color-neutral-600)' }}>تقرير طالب للمتابعة · {CURRENT_ACADEMIC_YEAR}</div>
            </div>
          </div>
          <div style={{ fontSize: 13, textAlign: 'left' }}>
            <div><strong>{name}</strong></div>
            <div>{[student?.displayId || roster?.displayId, student?.grade || roster?.grade].filter(Boolean).join(' · ')}</div>
            <div>المعلّم: {profile?.name || '—'}</div>
            {demo ? <div>عرض توضيحي</div> : null}
          </div>
        </div>

        {roster?.classes?.length > 0 && (
          <div style={{ fontSize: 13 }}>
            الصفوف: {roster.classes.map((c) => c.title).join(' · ')}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12 }}>
            <div className="card-kicker">نسبة الحضور</div>
            <div className="ah-tabnum" style={{ fontSize: 22 }}>{rate == null ? '—' : `${rate}%`}</div>
          </div>
          <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12 }}>
            <div className="card-kicker">درجات معتمدة</div>
            <div className="ah-tabnum" style={{ fontSize: 22 }}>{approvedGrades.length}</div>
          </div>
          <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12 }}>
            <div className="card-kicker">ملاحظات</div>
            <div className="ah-tabnum" style={{ fontSize: 22 }}>{visibleNotes.length}</div>
          </div>
        </div>

        <div>
          <div className="card-title" style={{ fontSize: 15, marginBottom: 8 }}>الدرجات المعتمدة</div>
          <table className="table">
            <thead><tr><th>التقييم</th><th>الصف</th><th>الدرجة</th><th>التقدير</th></tr></thead>
            <tbody>
              {approvedGrades.length === 0 && <EmptyRow colSpan={4}>لا درجات معتمدة.</EmptyRow>}
              {approvedGrades.map((g) => (
                <tr key={g.id}>
                  <td>{g.assessmentTitle}</td>
                  <td>{g.className}</td>
                  <td className="ah-tabnum">{g.score}/{g.maxScore}</td>
                  <td>{scoreToBand(g.score, g.maxScore)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <div className="card-title" style={{ fontSize: 15, marginBottom: 8 }}>ملخص الحضور (آخر 20)</div>
          <table className="table">
            <thead><tr><th>التاريخ</th><th>الصف</th><th>الحالة</th></tr></thead>
            <tbody>
              {myAttendance.slice(0, 20).length === 0 && <EmptyRow colSpan={3}>لا سجلات.</EmptyRow>}
              {myAttendance.slice(0, 20).map((r, i) => (
                <tr key={`${r.date}-${i}`}>
                  <td className="ah-tabnum">{r.date}</td>
                  <td>{r.className || r.subject || '—'}</td>
                  <td>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <div className="card-title" style={{ fontSize: 15, marginBottom: 8 }}>ملاحظات للمشاركة مع ولي الأمر</div>
          {visibleNotes.length === 0 && <div style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>لا ملاحظات.</div>}
          <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 13, lineHeight: 1.7 }}>
            {visibleNotes.map((n) => (
              <li key={n.id || n.note}>
                <strong>{[n.kind, n.sentiment].filter(Boolean).join(' · ')}</strong>
                {' — '}
                {n.note || n.body}
              </li>
            ))}
          </ul>
        </div>

        <div style={{ fontSize: 11, color: 'var(--color-neutral-500)', marginTop: 8 }}>
          تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')} · للاجتماع مع ولي الأمر
        </div>
        <div className="no-print">
          <Link to={`/teacher/students/${id}`} style={{ fontSize: 13 }}>← ملف الطالب</Link>
        </div>
      </div>
    </div>
  );
}
