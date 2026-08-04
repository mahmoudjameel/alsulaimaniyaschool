import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { orderBy } from 'firebase/firestore';
import Icon from './Icon';
import { useDocOrDemo, useLiveOrDemo } from '../hooks/useFirestore';
import { demoAttendanceRecords, demoStudentDetail, demoStudents } from '../data/demo';
import { computeAttendanceRate } from '../lib/attendance';

function demoStudent(id) {
  return demoStudents.find((s) => s.id === id) || null;
}

export default function TeacherStudentPeek({ studentId, classId, classTitle, onClose }) {
  const { data: student, demo } = useDocOrDemo(
    studentId ? `students/${studentId}` : null,
    demoStudent(studentId),
  );
  const detail = demoStudentDetail[studentId];

  const { data: guardians } = useLiveOrDemo(
    studentId ? `students/${studentId}/guardians` : '__none__',
    [orderBy('createdAt', 'asc')],
    detail?.guardians || [],
    studentId,
  );
  const { data: notes } = useLiveOrDemo(
    studentId ? `students/${studentId}/notes` : '__none__',
    [orderBy('createdAt', 'desc')],
    detail?.notes || [],
    studentId,
  );
  const { data: attendance } = useLiveOrDemo(
    studentId ? `students/${studentId}/attendanceRecords` : '__none__',
    [orderBy('date', 'desc')],
    demoAttendanceRecords[studentId] || [],
    studentId,
  );

  const classAttendance = useMemo(
    () => (attendance || []).filter((r) => !classId || r.classId === classId),
    [attendance, classId],
  );
  const rate = computeAttendanceRate(classAttendance);
  const recentNotes = (notes || []).slice(0, 5);
  const primaryGuardian = (guardians || []).find((g) => g.primary) || (guardians || [])[0];
  const phone = primaryGuardian?.phone
    || student?.guardianPhoneWa
    || student?.guardianPhoneE164
    || student?.guardianPhone
    || student?.guardianPhoneLocal
    || '—';
  const guardianName = primaryGuardian?.name || student?.guardianName || '—';

  if (!studentId) return null;

  return (
    <div className="dialog-backdrop" onClick={onClose} role="presentation">
      <div
        className="dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{ width: 'min(520px, 100%)', gap: 14 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="dialog-title" style={{ margin: 0 }}>ملف سريع</div>
          <button type="button" className="btn btn-icon btn-ghost" style={{ marginInlineStart: 'auto' }} onClick={onClose} aria-label="إغلاق">
            <Icon name="close" size={18} />
          </button>
        </div>

        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{student?.name || 'طالب'}</div>
          <div style={{ fontSize: 13, color: 'var(--color-neutral-600)', marginTop: 4 }}>
            {[student?.displayId, student?.grade || student?.stageLabel, classTitle].filter(Boolean).join(' · ')}
            {demo ? ' · عرض' : ''}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="card" style={{ padding: 12, gap: 4 }}>
            <span className="card-kicker">نسبة الحضور</span>
            <div className="ah-tabnum" style={{ fontSize: 24, fontFamily: 'var(--font-heading)' }}>
              {rate == null ? '—' : `${rate}%`}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>
              {classAttendance.length} يوم مسجّل{classId ? ' لهذا الصف' : ''}
            </div>
          </div>
          <div className="card" style={{ padding: 12, gap: 4 }}>
            <span className="card-kicker">ولي الأمر</span>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{guardianName}</div>
            <div className="ah-tabnum" style={{ fontSize: 13 }} dir="ltr">{phone}</div>
          </div>
        </div>

        <div>
          <div className="card-title" style={{ fontSize: 15, marginBottom: 8 }}>آخر الملاحظات</div>
          {recentNotes.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>لا ملاحظات بعد.</div>
          )}
          <div style={{ display: 'grid', gap: 8 }}>
            {recentNotes.map((n) => (
              <div
                key={n.id || `${n.kind}-${n.note?.slice(0, 12)}`}
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'color-mix(in srgb, var(--color-neutral-100) 85%, transparent)',
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                <div style={{ fontSize: 11, color: 'var(--color-neutral-500)', marginBottom: 4 }}>
                  {[n.kind, n.sentiment].filter(Boolean).join(' · ')}
                </div>
                {n.note || n.body || '—'}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link
            to={`/teacher/observations?class=${classId || ''}`}
            className="btn btn-secondary"
            style={{ fontSize: 12, textDecoration: 'none' }}
            onClick={onClose}
          >
            إضافة ملاحظة
          </Link>
          <Link
            to={`/teacher/grades?class=${classId || ''}`}
            className="btn btn-secondary"
            style={{ fontSize: 12, textDecoration: 'none' }}
            onClick={onClose}
          >
            رصد درجة
          </Link>
          <button type="button" className="btn btn-primary" onClick={onClose} style={{ marginInlineStart: 'auto' }}>
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
