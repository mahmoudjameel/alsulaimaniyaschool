import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { orderBy, where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { EmptyRow, ErrorBanner } from '../../components/ui';
import { useMyClasses } from '../../hooks/useMyClasses';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { demoEnrollments } from '../../data/demo';

export default function TeacherDashboard() {
  const { myClasses, profile, error, demo } = useMyClasses();
  const { data: myGradeEntries } = useLiveOrDemo(
    'gradeEntries',
    [where('teacherId', '==', profile?.id || '__none__'), orderBy('createdAt', 'desc')],
    [],
    profile?.id,
  );
  const pendingGrades = useMemo(
    () => myGradeEntries.filter((g) => g.status === 'قيد المراجعة'),
    [myGradeEntries],
  );

  const [focusClassId, setFocusClassId] = useState('');
  const activeId = focusClassId || myClasses[0]?.id || '';
  const { data: enrolled } = useLiveOrDemo(
    activeId ? `classes/${activeId}/enrollments` : '__none__',
    [orderBy('enrolledAt', 'asc')],
    demoEnrollments[activeId] || [],
  );
  const { data: classAttempts } = useLiveOrDemo(
    'quizAttempts',
    [where('classId', '==', activeId || '__none__')],
    [],
    activeId || '__none__',
  );
  const recentAttempts = useMemo(() => {
    const list = [...(classAttempts || [])];
    list.sort((a, b) => (b.submittedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0)
      - (a.submittedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0));
    return list.slice(0, 6);
  }, [classAttempts]);

  const totalStudents = useMemo(
    () => myClasses.reduce((n, c) => n + (c.studentsCount || 0), 0),
    [myClasses],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <ErrorBanner>{error && 'تعذّر تحميل صفوفك.'}</ErrorBanner>

      <div className="ah-3col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        <div className="card">
          <div className="card-kicker">مساقاتي</div>
          <div className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 32 }}>{myClasses.length}</div>
          <div className="card-meta">صفوف مسندة إليك</div>
        </div>
        <div className="card">
          <div className="card-kicker">طلابي</div>
          <div className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 32 }}>{totalStudents || enrolled.length}</div>
          <div className="card-meta">عبر كل المساقات</div>
        </div>
        <div className="card">
          <div className="card-kicker">درجات بانتظار الاعتماد</div>
          <div className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 32 }}>{pendingGrades.length}</div>
          <div className="card-meta">أرسلتها للإدارة</div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <div className="card-title" style={{ margin: 0 }}>تسليمات اختبارات الطلاب</div>
          <Link to={`/teacher/quiz?class=${activeId}`} className="btn btn-secondary" style={{ fontSize: 12, textDecoration: 'none', marginInlineStart: 'auto' }}>
            فتح الاختبارات
          </Link>
        </div>
        {recentAttempts.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>
            لا تسليمات بعد لهذا المساق — تظهر عندما يحلّ الطلاب من بوابتهم.
          </div>
        )}
        {recentAttempts.map((a) => (
          <div key={a.id} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line)', flexWrap: 'wrap', alignItems: 'center' }}>
            <strong style={{ fontSize: 14 }}>{a.studentName || 'طالب'}</strong>
            <span style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>{a.quizTitle}</span>
            <span className="tag tag-outline" style={{ fontSize: 10 }}>
              {a.percent != null ? `${a.percent}%` : `${a.score ?? '—'}/${a.maxScore ?? '—'}`}
            </span>
            {(a.details || []).some((d) => d.needsReview) && (
              <span className="tag tag-accent-2" style={{ fontSize: 10 }}>مراجعة</span>
            )}
          </div>
        ))}
      </div>

      <div className="ah-2col" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, alignItems: 'start' }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div className="card-title" style={{ margin: 0 }}>مساقاتي ودروسي</div>
            <span style={{ marginInlineStart: 'auto' }} />
            <Link to="/teacher/builder" className="btn btn-primary" style={{ fontSize: 12, textDecoration: 'none' }}>
              <Icon name="add" size={13} /> درس جديد
            </Link>
          </div>
          {myClasses.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>لا توجد صفوف مسندة إليك بعد. اطلب من الإدارة تعيينك معلّماً لصفّ.</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {myClasses.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setFocusClassId(c.id)}
                className="card"
                style={{
                  padding: 14, textAlign: 'right', cursor: 'pointer',
                  borderColor: activeId === c.id ? 'var(--gold)' : undefined,
                  background: 'transparent',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{c.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>
                      {c.subject} · {c.grade} · {c.shift}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-neutral-600)', textAlign: 'left' }}>
                    <div>{c.studentsCount ?? '—'} طالب</div>
                    <div>{c.lessonsCount ?? 0} درساً</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <Link to={`/teacher/builder?class=${c.id}`} onClick={(e) => e.stopPropagation()} className="btn btn-secondary" style={{ fontSize: 11, textDecoration: 'none' }}>الدروس</Link>
                  <Link to={`/teacher/quiz?class=${c.id}`} onClick={(e) => e.stopPropagation()} className="btn btn-secondary" style={{ fontSize: 11, textDecoration: 'none' }}>اختبارات</Link>
                  <Link to="/teacher/attendance" onClick={(e) => e.stopPropagation()} className="btn btn-secondary" style={{ fontSize: 11, textDecoration: 'none' }}>حضور</Link>
                  <Link to="/teacher/observations" onClick={(e) => e.stopPropagation()} className="btn btn-secondary" style={{ fontSize: 11, textDecoration: 'none' }}>ملاحظات</Link>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 8 }}>
            طلاب {myClasses.find((c) => c.id === activeId)?.title || 'الصف'}
          </div>
          <table className="table">
            <thead><tr><th>الطالب</th><th>الرقم</th><th>الصف</th></tr></thead>
            <tbody>
              {enrolled.length === 0 && <EmptyRow colSpan={3}>لا طلاب مسجّلين في هذا الصف بعد.</EmptyRow>}
              {enrolled.map((s) => (
                <tr key={s.studentId || s.id}>
                  <td>{s.studentName || s.name}</td>
                  <td className="ah-tabnum">{s.displayId || '—'}</td>
                  <td>{s.grade || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {demo && <div style={{ fontSize: 11, color: 'var(--color-neutral-500)', marginTop: 8 }}>عرض توضيحي — صِل Firebase لبيانات حية.</div>}
        </div>
      </div>
    </div>
  );
}
