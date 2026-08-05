import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { orderBy, where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import SearchInput from '../../components/SearchInput';
import { ErrorBanner, EmptyRow } from '../../components/ui';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { useAuth } from '../../context/AuthContext';
import { useMyClasses } from '../../hooks/useMyClasses';
import { demoEnrollments, demoStudents } from '../../data/demo';
import { ASSESSMENT_TYPES, CONTINUOUS_TYPES, defaultMaxForType, submitGrade } from '../../services/grades';
import { filterByStudentSearch, matchesStudentSearch } from '../../lib/studentSearch';
import { SCHOOL_NAME_AR } from '../../lib/constants';
import { TEACHER_GRADE_TEMPLATE } from '../../lib/phone';
import { openGuardianWhatsApp } from '../../lib/teacherWhatsApp';

const STATUS_TONE = { 'قيد المراجعة': 'outline', 'معتمد': 'accent', 'مرفوض': 'neutral' };
const TERMS = ['الفصل الأول', 'الفصل الثاني', ''];

export default function Grades() {
  const { profile } = useAuth();
  const [params] = useSearchParams();
  const { myClasses } = useMyClasses();
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
  );
  const enrolledOptions = useMemo(() => filterByStudentSearch(enrolled, search), [enrolled, search]);

  const { data: myGrades, error, demo } = useLiveOrDemo(
    'gradeEntries',
    [where('teacherId', '==', profile?.id || '__none__'), orderBy('createdAt', 'desc')],
    [],
    profile?.id,
  );

  const gradesForClass = useMemo(() => {
    const base = activeClassId ? myGrades.filter((g) => g.classId === activeClassId) : myGrades;
    return base.filter((g) => matchesStudentSearch(g, search));
  }, [myGrades, activeClassId, search]);

  const [studentId, setStudentId] = useState('');
  const [assessmentType, setAssessmentType] = useState(ASSESSMENT_TYPES[0]);
  const [assessmentTitle, setAssessmentTitle] = useState('');
  const [term, setTerm] = useState(TERMS[0]);
  const [score, setScore] = useState('');
  const [maxScore, setMaxScore] = useState(String(defaultMaxForType(ASSESSMENT_TYPES[0])));
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [lastGrade, setLastGrade] = useState(null);

  const { data: studentsDir } = useLiveOrDemo('students', [orderBy('name', 'asc')], demoStudents);

  useEffect(() => {
    setMaxScore(String(defaultMaxForType(assessmentType)));
  }, [assessmentType]);

  const resolvedTitle = (assessmentTitle || '').trim()
    || (assessmentType === 'أخرى' ? '' : assessmentType);

  const onSubmit = async (e) => {
    e.preventDefault();
    const student = enrolled.find((s) => (s.studentId || s.id) === studentId);
    if (!student || !activeClass) return;
    if (!resolvedTitle) {
      setMessage('أدخل عنوان التقييم أو اختر نوعاً غير «أخرى».');
      return;
    }
    setSubmitting(true);
    setMessage('');
    try {
      if (demo) {
        setMessage('وضع العرض التوضيحي: صِل مشروع Firebase لإرسال الدرجات فعلياً.');
      } else {
        await submitGrade({
          classId: activeClassId,
          className: activeClass.title,
          subject: activeClass.subject,
          studentId: student.studentId || student.id,
          studentName: student.studentName || student.name,
          teacherId: profile.id,
          teacherName: profile.name,
          assessmentTitle: resolvedTitle,
          assessmentType,
          term,
          score,
          maxScore,
        });
        setLastGrade({
          studentId: student.studentId || student.id,
          studentName: student.studentName || student.name,
          assessmentTitle: resolvedTitle,
          scoreLabel: `${score}/${maxScore}`,
        });
        setMessage('أُرسلت الدرجة للإدارة بانتظار الاعتماد — تظهر للطالب بعد الاعتماد.');
        setAssessmentTitle('');
        setScore('');
        setStudentId('');
      }
    } catch {
      setMessage('تعذّر إرسال الدرجة.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ErrorBanner>{error && 'تعذّر تحميل الدرجات.'}</ErrorBanner>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)', lineHeight: 1.7 }}>
        رصد درجة لطالب واحد (دفتر / حضور / نشاط / اختبارات). للرصد الجماعي للمستمرة استخدم{' '}
        <Link to={`/teacher/continuous-grades?class=${activeClassId}`}>درجات دفتر وحضور ونشاط</Link>.
        تُرسل بحالة «قيد المراجعة» حتى تعتمدها الإدارة.
      </p>
      <div className="ah-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 16, alignItems: 'start' }}>
        <form className="card" onSubmit={onSubmit}>
          <div className="card-title" style={{ marginBottom: 8 }}>رصد درجة</div>
          <div className="field">
            <label>الصف</label>
            <select className="input" value={activeClassId} onChange={(e) => { setClassId(e.target.value); setStudentId(''); setSearch(''); }}>
              {myClasses.length === 0 && <option value="">لا صفوف مسندة</option>}
              {myClasses.map((c) => (
                <option key={c.id} value={c.id}>{c.title} — {c.subject}{c.grade ? ` · ${c.grade}` : ''}</option>
              ))}
            </select>
          </div>
          <div style={{ marginTop: 10 }}>
            <SearchInput value={search} onChange={setSearch} placeholder="بحث عن طالب بالاسم أو الرقم…" />
          </div>
          <div className="field" style={{ marginTop: 10 }}>
            <label>الطالب</label>
            <select className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
              <option value="" disabled>اختر طالباً…</option>
              {enrolledOptions.map((s) => (
                <option key={s.studentId || s.id} value={s.studentId || s.id}>
                  {s.studentName || s.name}{s.displayId ? ` — ${s.displayId}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            <div className="field">
              <label>نوع التقييم</label>
              <select className="input" value={assessmentType} onChange={(e) => setAssessmentType(e.target.value)}>
                <optgroup label="درجات مستمرة">
                  {CONTINUOUS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </optgroup>
                <optgroup label="اختبارات وفرض">
                  {ASSESSMENT_TYPES.filter((t) => !CONTINUOUS_TYPES.includes(t)).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div className="field">
              <label>الفصل</label>
              <select className="input" value={term} onChange={(e) => setTerm(e.target.value)}>
                <option value={TERMS[0]}>{TERMS[0]}</option>
                <option value={TERMS[1]}>{TERMS[1]}</option>
                <option value="">غير محدد</option>
              </select>
            </div>
          </div>
          <div className="field" style={{ marginTop: 10 }}>
            <label>عنوان إضافي (اختياري)</label>
            <input
              className="input"
              value={assessmentTitle}
              onChange={(e) => setAssessmentTitle(e.target.value)}
              placeholder={assessmentType === 'أخرى' ? 'مثال: مشاركة صفّية' : `مثال: ${assessmentType} — الوحدة 3`}
              required={assessmentType === 'أخرى'}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            <div className="field">
              <label>الدرجة</label>
              <input className="input" type="number" value={score} onChange={(e) => setScore(e.target.value)} required dir="ltr" style={{ textAlign: 'right' }} />
            </div>
            <div className="field">
              <label>من أصل</label>
              <input className="input" type="number" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} required dir="ltr" style={{ textAlign: 'right' }} />
            </div>
          </div>
          {message && <div style={{ fontSize: 12, color: 'var(--color-accent-700)', marginTop: 8 }}>{message}</div>}
          <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 12 }} disabled={submitting || !myClasses.length}>
            <Icon name="send" size={14} /> {submitting ? 'جارٍ الإرسال…' : 'إرسال للاعتماد'}
          </button>
          {lastGrade && (
            <button
              type="button"
              className="btn btn-secondary btn-block"
              style={{ marginTop: 8 }}
              onClick={() => {
                const st = (studentsDir || []).find((s) => s.id === lastGrade.studentId);
                const ok = openGuardianWhatsApp(
                  st,
                  TEACHER_GRADE_TEMPLATE(
                    SCHOOL_NAME_AR,
                    profile?.name,
                    lastGrade.studentName,
                    lastGrade.assessmentTitle,
                    `${lastGrade.scoreLabel} (بانتظار اعتماد الإدارة)`,
                  ),
                );
                if (!ok) window.alert('لا رقم واتساب لولي الأمر — حدّثه من الإدارة.');
              }}
            >
              <Icon name="chat" size={14} /> إبلاغ ولي الأمر واتساب
            </button>
          )}
          <Link
            to={`/teacher/grade-sheet?class=${activeClassId}`}
            className="btn btn-ghost btn-block"
            style={{ marginTop: 8, textDecoration: 'none', fontSize: 13 }}
          >
            <Icon name="print" size={14} /> كشف درجات للطباعة
          </Link>
        </form>

        <div className="card ah-table-wrap" style={{ padding: 0 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="card-title" style={{ margin: 0 }}>درجات هذا الصف</div>
            <Link to={`/teacher/grade-sheet?class=${activeClassId}`} className="btn btn-ghost" style={{ fontSize: 12, marginInlineStart: 'auto', textDecoration: 'none' }}>
              طباعة الكشف
            </Link>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>الطالب</th>
                <th>النوع</th>
                <th>التقييم</th>
                <th>الدرجة</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {gradesForClass.length === 0 && <EmptyRow colSpan={5}>لا درجات مرصودة بعد لهذا الصف.</EmptyRow>}
              {gradesForClass.map((g) => (
                <tr key={g.id}>
                  <td>{g.studentName}</td>
                  <td style={{ fontSize: 12 }}>{g.assessmentType || '—'}</td>
                  <td>
                    {g.assessmentTitle}
                    {g.term ? <div style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>{g.term}</div> : null}
                  </td>
                  <td className="ah-tabnum">{g.score}/{g.maxScore}</td>
                  <td><span className={`tag tag-${STATUS_TONE[g.status] || 'neutral'}`}>{g.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
