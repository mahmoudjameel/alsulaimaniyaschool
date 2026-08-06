import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { orderBy } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { EmptyRow, ErrorBanner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useMyClasses } from '../../hooks/useMyClasses';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { demoEnrollments } from '../../data/demo';
import {
  ASSESSMENT_TYPES,
  CONTINUOUS_TYPES,
  defaultMaxForType,
  submitGrade,
} from '../../services/grades';
import TermSelect, { useDefaultActiveTerm } from '../../components/TermSelect';
import { isTermClosed } from '../../services/academicCalendar';

export default function TeacherBulkGrades() {
  const { profile } = useAuth();
  const [params] = useSearchParams();
  const { myClasses, error, demo } = useMyClasses();
  const [classId, setClassId] = useState(params.get('class') || '');
  const activeClassId = classId || myClasses[0]?.id || '';
  const activeClass = myClasses.find((c) => c.id === activeClassId);

  const [assessmentType, setAssessmentType] = useState(ASSESSMENT_TYPES[0]);
  const [assessmentTitle, setAssessmentTitle] = useState('');
  const [term, setTerm] = useState('');
  const calendar = useDefaultActiveTerm(setTerm);
  const [maxScore, setMaxScore] = useState(String(defaultMaxForType(ASSESSMENT_TYPES[0])));
  const [scores, setScores] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fromUrl = params.get('class');
    if (fromUrl) setClassId(fromUrl);
  }, [params]);

  useEffect(() => {
    setMaxScore(String(defaultMaxForType(assessmentType)));
  }, [assessmentType]);

  const { data: enrolled } = useLiveOrDemo(
    activeClassId ? `classes/${activeClassId}/enrollments` : '__none__',
    [orderBy('enrolledAt', 'asc')],
    demoEnrollments[activeClassId] || [],
    activeClassId,
  );

  const rows = useMemo(
    () => [...(enrolled || [])].sort((a, b) => String(a.studentName || a.name).localeCompare(String(b.studentName || b.name), 'ar')),
    [enrolled],
  );

  const title = (assessmentTitle || '').trim() || (assessmentType === 'أخرى' ? '' : assessmentType);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!activeClass || !title) {
      setMessage('أدخل عنوان التقييم.');
      return;
    }
    if (demo) {
      setMessage('وضع العرض: صِل Firebase لإرسال الدرجات.');
      return;
    }
    const filled = rows.filter((s) => {
      const sid = s.studentId || s.id;
      const v = scores[sid];
      return v !== undefined && v !== '';
    });
    if (filled.length === 0) {
      setMessage('أدخل درجة لطالب واحد على الأقل.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      for (const s of filled) {
        const sid = s.studentId || s.id;
        await submitGrade({
          classId: activeClassId,
          className: activeClass.title,
          subject: activeClass.subject,
          studentId: sid,
          studentName: s.studentName || s.name,
          teacherId: profile.id,
          teacherName: profile.name,
          assessmentTitle: title,
          assessmentType,
          term,
          score: scores[sid],
          maxScore,
        });
      }
      setMessage(`أُرسلت ${filled.length} درجة للإدارة بانتظار الاعتماد.`);
      setScores({});
    } catch (err) {
      if (err?.code === 'TERM_CLOSED' || err?.message === 'TERM_CLOSED') {
        setMessage(`الفصل «${term || err.term || ''}» مقفل من الإدارة — لا يُقبل إدخال درجات جديدة عليه.`);
      } else if (err?.code === 'TERM_REQUIRED' || err?.message === 'TERM_REQUIRED') {
        setMessage('اختري الفصل الدراسي قبل إرسال الدرجات.');
      } else {
        setMessage('تعذّر إرسال بعض الدرجات.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ErrorBanner>{error && 'تعذّر التحميل.'}</ErrorBanner>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)', lineHeight: 1.7 }}>
        رصد تقييم واحد لكل طلاب الصف دفعة واحدة — تُرسل بحالة «قيد المراجعة» حتى تعتمدها الإدارة وتظهر للطالب.
      </p>

      <form className="card" onSubmit={onSubmit} style={{ gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          <div className="field">
            <label>الصف</label>
            <select className="input" value={activeClassId} onChange={(e) => { setClassId(e.target.value); setScores({}); }}>
              {myClasses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
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
            <TermSelect value={term} onChange={setTerm} />
          </div>
          <div className="field">
            <label>من أصل</label>
            <input className="input" type="number" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} dir="ltr" required />
          </div>
        </div>
        {isTermClosed(calendar, term) && (
          <div style={{ fontSize: 13, color: 'var(--color-accent-2-700)' }}>
            هذا الفصل مقفل من الإدارة — لا يمكن إدخال درجات عليه.
          </div>
        )}
        <div className="field">
          <label>عنوان التقييم</label>
          <input className="input" value={assessmentTitle} onChange={(e) => setAssessmentTitle(e.target.value)} placeholder={assessmentType} required={assessmentType === 'أخرى'} />
        </div>

        <div className="ah-table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>الطالب</th>
                <th>الرقم</th>
                <th>الدرجة / {maxScore || '—'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <EmptyRow colSpan={3}>لا طلاب في الصف.</EmptyRow>}
              {rows.map((s) => {
                const sid = s.studentId || s.id;
                return (
                  <tr key={sid}>
                    <td>{s.studentName || s.name}</td>
                    <td className="ah-tabnum">{s.displayId || '—'}</td>
                    <td>
                      <input
                        className="input"
                        type="number"
                        style={{ maxWidth: 100 }}
                        dir="ltr"
                        value={scores[sid] ?? ''}
                        onChange={(e) => setScores((prev) => ({ ...prev, [sid]: e.target.value }))}
                        placeholder="—"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {message && <div style={{ fontSize: 13, color: 'var(--color-accent-700)' }}>{message}</div>}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="submit" className="btn btn-primary" disabled={busy || !rows.length}>
            <Icon name="send" size={14} /> {busy ? 'جارٍ الإرسال…' : 'إرسال الكل للاعتماد'}
          </button>
          <Link to={`/teacher/grades?class=${activeClassId}`} className="btn btn-secondary" style={{ textDecoration: 'none' }}>
            رصد فردي
          </Link>
          <Link to={`/teacher/continuous-grades?class=${activeClassId}`} className="btn btn-ghost" style={{ textDecoration: 'none' }}>
            دفتر · حضور · نشاط
          </Link>
        </div>
      </form>
    </div>
  );
}
