import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { orderBy, where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { EmptyRow, ErrorBanner, SegmentedTabs } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useMyClasses } from '../../hooks/useMyClasses';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { demoEnrollments } from '../../data/demo';
import {
  CONTINUOUS_TYPES,
  assessmentTypeLabel,
  defaultMaxForType,
  submitGrade,
} from '../../services/grades';

const TERMS = ['الفصل الأول', 'الفصل الثاني'];

const TYPE_HINT = {
  دفتر: 'متابعة حل الدفتر والواجبات المكتوبة في الصف.',
  حضور: 'درجة الانضباط والحضور خلال الفترة (ليست سجل الغياب اليومي).',
  نشاط: 'مشاركة، عروض، عمل جماعي، أو نشاط صفّي.',
};

export default function TeacherContinuousGrades() {
  const { profile } = useAuth();
  const [params] = useSearchParams();
  const { myClasses, error, demo } = useMyClasses();
  const [classId, setClassId] = useState(params.get('class') || '');
  const activeClassId = classId || myClasses[0]?.id || '';
  const activeClass = myClasses.find((c) => c.id === activeClassId);

  const typeFromUrl = params.get('type');
  const [assessmentType, setAssessmentType] = useState(
    CONTINUOUS_TYPES.includes(typeFromUrl) ? typeFromUrl : 'دفتر',
  );
  const [term, setTerm] = useState(TERMS[0]);
  const [periodLabel, setPeriodLabel] = useState('');
  const [maxScore, setMaxScore] = useState(String(defaultMaxForType('دفتر')));
  const [scores, setScores] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fromUrl = params.get('class');
    if (fromUrl) setClassId(fromUrl);
    const t = params.get('type');
    if (CONTINUOUS_TYPES.includes(t)) setAssessmentType(t);
  }, [params]);

  useEffect(() => {
    setMaxScore(String(defaultMaxForType(assessmentType)));
    setScores({});
    setMessage('');
  }, [assessmentType, activeClassId]);

  const { data: enrolled } = useLiveOrDemo(
    activeClassId ? `classes/${activeClassId}/enrollments` : '__none__',
    [orderBy('enrolledAt', 'asc')],
    demoEnrollments[activeClassId] || [],
    activeClassId,
  );

  const { data: myGrades } = useLiveOrDemo(
    'gradeEntries',
    [where('teacherId', '==', profile?.id || '__none__'), orderBy('createdAt', 'desc')],
    [],
    profile?.id,
  );

  const rows = useMemo(
    () => [...(enrolled || [])].sort((a, b) => String(a.studentName || a.name).localeCompare(String(b.studentName || b.name), 'ar')),
    [enrolled],
  );

  const recentSameType = useMemo(() => {
    return (myGrades || [])
      .filter((g) => g.classId === activeClassId && g.assessmentType === assessmentType)
      .slice(0, 12);
  }, [myGrades, activeClassId, assessmentType]);

  const title = useMemo(() => {
    const period = (periodLabel || '').trim();
    const base = assessmentTypeLabel(assessmentType);
    return period ? `${base} — ${period}` : `${base} — ${term}`;
  }, [assessmentType, periodLabel, term]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!activeClass || !profile?.id) return;
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
      setMessage(`أُرسلت ${filled.length} درجة «${assessmentTypeLabel(assessmentType)}» للإدارة بانتظار الاعتماد — تظهر للطالب بعد الاعتماد.`);
      setScores({});
    } catch {
      setMessage('تعذّر إرسال بعض الدرجات.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ErrorBanner>{error && 'تعذّر التحميل.'}</ErrorBanner>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)', lineHeight: 1.7 }}>
        رصد الدرجات المستمرة للصف: <strong>دفتر</strong>، <strong>حضور</strong>، و<strong>نشاط</strong>.
        تُرسل للإدارة ثم تظهر للطالب وولي الأمر بعد الاعتماد.
      </p>

      <SegmentedTabs
        tabs={CONTINUOUS_TYPES.map((t) => ({
          id: t,
          label: assessmentTypeLabel(t),
          active: assessmentType === t,
          onClick: () => setAssessmentType(t),
        }))}
      />

      <div className="card" style={{ gap: 8, padding: 14 }}>
        <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', lineHeight: 1.6 }}>
          {TYPE_HINT[assessmentType]}
        </div>
      </div>

      <form className="card" onSubmit={onSubmit} style={{ gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          <div className="field">
            <label>الصف</label>
            <select className="input" value={activeClassId} onChange={(e) => { setClassId(e.target.value); setScores({}); }}>
              {myClasses.map((c) => <option key={c.id} value={c.id}>{c.title} — {c.subject}</option>)}
            </select>
          </div>
          <div className="field">
            <label>الفصل</label>
            <select className="input" value={term} onChange={(e) => setTerm(e.target.value)}>
              {TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="field">
            <label>من أصل</label>
            <input className="input" type="number" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} dir="ltr" required min="1" />
          </div>
          <div className="field">
            <label>الفترة / الوصف (اختياري)</label>
            <input
              className="input"
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              placeholder="مثال: أيلول · الوحدة 1"
            />
          </div>
        </div>

        <div style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>
          عنوان التقييم المرسل: <strong>{title}</strong>
        </div>

        <div className="ah-table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>الطالب</th>
                <th>الرقم</th>
                <th>{assessmentTypeLabel(assessmentType)} / {maxScore || '—'}</th>
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
                        style={{ maxWidth: 110 }}
                        dir="ltr"
                        min="0"
                        max={Number(maxScore) || undefined}
                        step="0.5"
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
            <Icon name="send" size={14} /> {busy ? 'جارٍ الإرسال…' : `إرسال درجات ${assessmentType} للاعتماد`}
          </button>
          <Link to={`/teacher/grades?class=${activeClassId}`} className="btn btn-secondary" style={{ textDecoration: 'none' }}>
            رصد فردي / اختبارات
          </Link>
          <Link to={`/teacher/grade-sheet?class=${activeClassId}`} className="btn btn-ghost" style={{ textDecoration: 'none' }}>
            كشف للطباعة
          </Link>
        </div>
      </form>

      <div className="card ah-table-wrap" style={{ padding: 0 }}>
        <div className="card-title" style={{ padding: '14px 16px', margin: 0, borderBottom: '1px solid var(--line)' }}>
          آخر رصد «{assessmentTypeLabel(assessmentType)}» لهذا الصف
        </div>
        <table className="table">
          <thead><tr><th>الطالب</th><th>التقييم</th><th>الدرجة</th><th>الحالة</th></tr></thead>
          <tbody>
            {recentSameType.length === 0 && <EmptyRow colSpan={4}>لا رصد سابق لهذا النوع بعد.</EmptyRow>}
            {recentSameType.map((g) => (
              <tr key={g.id}>
                <td>{g.studentName}</td>
                <td style={{ fontSize: 13 }}>{g.assessmentTitle}</td>
                <td className="ah-tabnum">{g.score}/{g.maxScore}</td>
                <td><span className={`tag tag-${g.status === 'معتمد' ? 'accent' : 'outline'}`}>{g.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
