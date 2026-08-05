import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { orderBy, where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import Logo from '../../components/Logo';
import { EmptyRow, ErrorBanner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useMyClasses } from '../../hooks/useMyClasses';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { demoEnrollments, demoGradeEntries } from '../../data/demo';
import { CURRENT_ACADEMIC_YEAR, SCHOOL_NAME_AR } from '../../lib/constants';
import { ASSESSMENT_TYPES, scoreToBand } from '../../services/grades';

export default function TeacherGradeSheet() {
  const { profile } = useAuth();
  const [params] = useSearchParams();
  const { myClasses, error, demo } = useMyClasses();
  const [classId, setClassId] = useState(params.get('class') || '');
  const activeClassId = classId || myClasses[0]?.id || '';
  const activeClass = myClasses.find((c) => c.id === activeClassId);
  const [assessmentType, setAssessmentType] = useState('');
  const [term, setTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('معتمد');

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

  const { data: myGrades } = useLiveOrDemo(
    'gradeEntries',
    [where('teacherId', '==', profile?.id || '__none__'), orderBy('createdAt', 'desc')],
    demoGradeEntries.filter((g) => g.teacherId === 't-khaled' || g.teacherId === profile?.id),
    profile?.id,
  );

  const classGrades = useMemo(() => {
    return (myGrades || []).filter((g) => {
      if (g.classId !== activeClassId) return false;
      if (statusFilter !== 'الكل' && g.status !== statusFilter) return false;
      if (assessmentType && g.assessmentType !== assessmentType) return false;
      if (term && g.term !== term) return false;
      return true;
    });
  }, [myGrades, activeClassId, statusFilter, assessmentType, term]);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ErrorBanner>{error && 'تعذّر تحميل الكشف.'}</ErrorBanner>

      <div className="no-print" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
        <div className="field" style={{ minWidth: 200, flex: 1 }}>
          <label>الصف</label>
          <select className="input" value={activeClassId} onChange={(e) => setClassId(e.target.value)}>
            {myClasses.map((c) => (
              <option key={c.id} value={c.id}>{c.title} — {c.subject}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ minWidth: 140 }}>
          <label>نوع التقييم</label>
          <select className="input" value={assessmentType} onChange={(e) => setAssessmentType(e.target.value)}>
            <option value="">الكل</option>
            <optgroup label="مستمرة">
              <option value="دفتر">دفتر</option>
              <option value="حضور">حضور</option>
              <option value="نشاط">نشاط</option>
            </optgroup>
            <optgroup label="اختبارات">
              {ASSESSMENT_TYPES.filter((t) => !['دفتر', 'حضور', 'نشاط'].includes(t)).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </optgroup>
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
        <Link to={`/teacher/grades?class=${activeClassId}`} className="btn btn-secondary" style={{ textDecoration: 'none' }}>
          رصد درجات
        </Link>
      </div>

      <div className="card print-page" style={{ gap: 14, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Logo size={44} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{SCHOOL_NAME_AR}</div>
              <div style={{ fontSize: 13, color: 'var(--color-neutral-600)' }}>كشف درجات صفّي · {CURRENT_ACADEMIC_YEAR}</div>
            </div>
          </div>
          <div style={{ fontSize: 13, textAlign: 'left', color: 'var(--color-neutral-700)' }}>
            <div><strong>{activeClass?.title || '—'}</strong></div>
            <div>{[activeClass?.subject, activeClass?.grade].filter(Boolean).join(' · ')}</div>
            <div>المعلّم: {profile?.name || activeClass?.teacher || '—'}</div>
            {demo ? <div>عرض توضيحي</div> : null}
          </div>
        </div>

        <div style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>
          الحالة المعروضة: {statusFilter}
          {assessmentType ? ` · ${assessmentType}` : ''}
          {term ? ` · ${term}` : ''}
          {' · '}الدرجات المعتمدة تظهر لأولياء الأمور والطلاب في بواباتهم.
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
                <EmptyRow colSpan={3}>لا درجات مطابقة للتصفية — ارصد درجات أو غيّر الفلاتر.</EmptyRow>
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
