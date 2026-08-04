import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { orderBy, where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import Logo from '../../components/Logo';
import BackButton from '../../components/BackButton';
import { EmptyRow, ErrorBanner } from '../../components/ui';
import { useDocOrDemo, useLiveOrDemo } from '../../hooks/useFirestore';
import { demoClasses, demoEnrollments, demoGradeEntries } from '../../data/demo';
import { CURRENT_ACADEMIC_YEAR, SCHOOL_NAME_AR } from '../../lib/constants';
import { ASSESSMENT_TYPES, scoreToBand } from '../../services/grades';

export default function ClassGradeSheet() {
  const { id } = useParams();
  const { data: cls, error, demo } = useDocOrDemo(`classes/${id}`, demoClasses.find((c) => c.id === id) || demoClasses[0]);
  const [assessmentType, setAssessmentType] = useState('');
  const [term, setTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('معتمد');

  const { data: enrolled } = useLiveOrDemo(
    id ? `classes/${id}/enrollments` : '__none__',
    [orderBy('enrolledAt', 'asc')],
    demoEnrollments[id] || [],
    id,
  );

  const { data: grades } = useLiveOrDemo(
    'gradeEntries',
    id ? [where('classId', '==', id), orderBy('createdAt', 'desc')] : [where('classId', '==', '__none__')],
    demoGradeEntries.filter((g) => g.classId === id),
    id,
  );

  const classGrades = useMemo(() => {
    return (grades || []).filter((g) => {
      if (statusFilter !== 'الكل' && g.status !== statusFilter) return false;
      if (assessmentType && g.assessmentType !== assessmentType) return false;
      if (term && g.term !== term) return false;
      return true;
    });
  }, [grades, statusFilter, assessmentType, term]);

  const assessments = useMemo(() => {
    const map = new Map();
    for (const g of classGrades) {
      const key = `${g.assessmentType || ''}::${g.assessmentTitle || 'تقييم'}::${g.term || ''}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          title: g.assessmentTitle || 'تقييم',
          type: g.assessmentType || '',
          term: g.term || '',
          maxScore: Number(g.maxScore) || 100,
        });
      }
    }
    return [...map.values()];
  }, [classGrades]);

  const rows = useMemo(() => {
    return (enrolled || []).map((s) => {
      const sid = s.studentId || s.id;
      const byAssessment = {};
      let sumPct = 0;
      let n = 0;
      for (const a of assessments) {
        const entry = classGrades.find(
          (g) => g.studentId === sid
            && (g.assessmentTitle || 'تقييم') === a.title
            && (g.assessmentType || '') === a.type
            && (g.term || '') === a.term,
        );
        byAssessment[a.key] = entry || null;
        if (entry && entry.maxScore) {
          sumPct += (Number(entry.score) / Number(entry.maxScore)) * 100;
          n += 1;
        }
      }
      return {
        studentId: sid,
        name: s.studentName || s.name,
        displayId: s.displayId || '—',
        byAssessment,
        avg: n ? Math.round(sumPct / n) : null,
      };
    }).sort((a, b) => String(a.name).localeCompare(String(b.name), 'ar'));
  }, [enrolled, assessments, classGrades]);

  if (!cls) return <ErrorBanner>تعذّر العثور على هذا الصف.</ErrorBanner>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ErrorBanner>{error && 'تعذّر تحميل الكشف.'}</ErrorBanner>
      <div className="no-print">
        <BackButton to={`/admin/classes/${id}`} label="عودة للصف" />
      </div>

      <div className="no-print" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
        <div className="field" style={{ minWidth: 140 }}>
          <label>نوع التقييم</label>
          <select className="input" value={assessmentType} onChange={(e) => setAssessmentType(e.target.value)}>
            <option value="">الكل</option>
            {ASSESSMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="field" style={{ minWidth: 140 }}>
          <label>الفصل</label>
          <select className="input" value={term} onChange={(e) => setTerm(e.target.value)}>
            <option value="">الكل</option>
            <option value="الفصل الأول">الفصل الأول</option>
            <option value="الفصل الثاني">الفصل الثاني</option>
          </select>
        </div>
        <div className="field" style={{ minWidth: 140 }}>
          <label>الحالة</label>
          <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="معتمد">معتمد فقط</option>
            <option value="قيد المراجعة">قيد المراجعة</option>
            <option value="الكل">الكل</option>
          </select>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          <Icon name="print" size={15} /> طباعة / PDF
        </button>
        <Link to="/admin/grades" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
          اعتماد الدرجات
        </Link>
      </div>

      <div className="card print-page" style={{ gap: 14, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Logo size={44} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{SCHOOL_NAME_AR}</div>
              <div style={{ fontSize: 13, color: 'var(--color-neutral-600)' }}>كشف درجات الصف · {CURRENT_ACADEMIC_YEAR}</div>
            </div>
          </div>
          <div style={{ fontSize: 13, textAlign: 'left', color: 'var(--color-neutral-700)' }}>
            <div><strong>{cls.title}</strong></div>
            <div>{[cls.subject, cls.grade].filter(Boolean).join(' · ')}</div>
            <div>المعلّم: {cls.teacher || '—'}</div>
            {demo ? <div>عرض توضيحي</div> : null}
          </div>
        </div>

        <div style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>
          الحالة المعروضة: {statusFilter}
          {assessmentType ? ` · ${assessmentType}` : ''}
          {term ? ` · ${term}` : ''}
          {' · '}الدرجات المعتمدة تظهر للطالب وولي الأمر في بواباتهما بعد الاعتماد من الإدارة.
        </div>

        <div className="ah-table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>الطالب</th>
                <th>الرقم</th>
                {assessments.map((a) => (
                  <th key={a.key}>
                    <div>{a.title}</div>
                    <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--color-neutral-500)' }}>
                      {[a.type, a.term, `/${a.maxScore}`].filter(Boolean).join(' · ')}
                    </div>
                  </th>
                ))}
                <th>المعدّل %</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <EmptyRow colSpan={3 + assessments.length}>لا طلاب في الصف.</EmptyRow>}
              {assessments.length === 0 && rows.length > 0 && (
                <EmptyRow colSpan={3}>لا درجات مطابقة — اعتمد درجات من لوحة الدرجات أو غيّر الفلاتر.</EmptyRow>
              )}
              {assessments.length > 0 && rows.map((r) => (
                <tr key={r.studentId}>
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td className="ah-tabnum">{r.displayId}</td>
                  {assessments.map((a) => {
                    const g = r.byAssessment[a.key];
                    if (!g) return <td key={a.key} className="ah-tabnum">—</td>;
                    return (
                      <td key={a.key} className="ah-tabnum">
                        {g.score}/{g.maxScore}
                        <div style={{ fontSize: 10, color: 'var(--color-neutral-500)' }}>{scoreToBand(g.score, g.maxScore)}</div>
                        {g.status !== 'معتمد' && (
                          <div style={{ fontSize: 10 }}>{g.status}</div>
                        )}
                      </td>
                    );
                  })}
                  <td className="ah-tabnum" style={{ fontWeight: 700 }}>{r.avg == null ? '—' : `${r.avg}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ fontSize: 11, color: 'var(--color-neutral-500)', marginTop: 8 }}>
          تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')}
        </div>
      </div>
    </div>
  );
}
