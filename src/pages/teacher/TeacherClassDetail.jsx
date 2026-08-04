import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { orderBy } from 'firebase/firestore';
import Icon from '../../components/Icon';
import SearchInput from '../../components/SearchInput';
import TeacherStudentPeek from '../../components/TeacherStudentPeek';
import { EmptyRow, ErrorBanner } from '../../components/ui';
import { useMyClasses } from '../../hooks/useMyClasses';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { demoEnrollments } from '../../data/demo';
import { filterByStudentSearch } from '../../lib/studentSearch';

export default function TeacherClassDetail() {
  const { id } = useParams();
  const { myClasses, error, demo } = useMyClasses();
  const cls = myClasses.find((c) => c.id === id);
  const [search, setSearch] = useState('');
  const [peekId, setPeekId] = useState(null);

  const { data: enrolled } = useLiveOrDemo(
    id ? `classes/${id}/enrollments` : '__none__',
    [orderBy('enrolledAt', 'asc')],
    demoEnrollments[id] || [],
    id,
  );
  const list = useMemo(() => filterByStudentSearch(enrolled, search), [enrolled, search]);

  if (!cls && !error) {
    return (
      <div className="card" style={{ gap: 12 }}>
        <p style={{ margin: 0 }}>الصف غير موجود أو غير مسند إليك.</p>
        <Link to="/teacher/classes" className="btn btn-secondary" style={{ textDecoration: 'none', width: 'fit-content' }}>
          العودة لصفوفي
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ErrorBanner>{error && 'تعذّر تحميل بيانات الصف.'}</ErrorBanner>

      <div className="card" style={{ gap: 10 }}>
        <Link to="/teacher/classes" style={{ fontSize: 13, color: 'var(--gold)', textDecoration: 'none', width: 'fit-content' }}>
          ← كل الصفوف
        </Link>
        <h2 style={{ margin: 0, fontSize: 22 }}>{cls?.title || 'الصف'}</h2>
        <div style={{ fontSize: 13, color: 'var(--color-neutral-600)' }}>
          {[cls?.subject, cls?.grade, cls?.shift].filter(Boolean).join(' · ')}
          {' · '}
          {enrolled.length} طالب
          {demo ? ' · عرض توضيحي' : ''}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          <Link to={`/teacher/attendance?class=${id}`} className="btn btn-primary" style={{ fontSize: 13, textDecoration: 'none' }}>
            <Icon name="fact_check" size={15} /> حضور وغياب
          </Link>
          <Link to={`/teacher/attendance-report?class=${id}`} className="btn btn-secondary" style={{ fontSize: 13, textDecoration: 'none' }}>
            <Icon name="analytics" size={15} /> تقرير حضور
          </Link>
          <Link to={`/teacher/grades?class=${id}`} className="btn btn-secondary" style={{ fontSize: 13, textDecoration: 'none' }}>
            <Icon name="grade" size={15} /> درجات
          </Link>
          <Link to={`/teacher/diary?class=${id}`} className="btn btn-secondary" style={{ fontSize: 13, textDecoration: 'none' }}>
            <Icon name="edit_note" size={15} /> دفتر اليوم
          </Link>
          <Link to={`/teacher/observations?class=${id}`} className="btn btn-secondary" style={{ fontSize: 13, textDecoration: 'none' }}>
            <Icon name="chat" size={15} /> ملاحظات
          </Link>
        </div>
      </div>

      <div className="card" style={{ gap: 12, padding: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="card-title" style={{ margin: 0 }}>كشف الطلاب</div>
          <div style={{ flex: 1, minWidth: 200, maxWidth: 360, marginInlineStart: 'auto' }}>
            <SearchInput value={search} onChange={setSearch} placeholder="بحث بالاسم أو الرقم…" />
          </div>
        </div>
        <div className="ah-table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>الطالب</th>
                <th>الرقم الدراسي</th>
                <th>الصف / المرحلة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && <EmptyRow colSpan={4}>لا طلاب في هذا الصف{search ? ' مطابقة للبحث' : ''}.</EmptyRow>}
              {list.map((s) => {
                const sid = s.studentId || s.id;
                return (
                  <tr key={sid}>
                    <td>{s.studentName || s.name}</td>
                    <td className="ah-tabnum">{s.displayId || '—'}</td>
                    <td>{s.grade || cls?.grade || '—'}</td>
                    <td style={{ textAlign: 'left' }}>
                      <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setPeekId(sid)}>
                        ملف سريع
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {peekId && (
        <TeacherStudentPeek
          studentId={peekId}
          classId={id}
          classTitle={cls?.title}
          onClose={() => setPeekId(null)}
        />
      )}
    </div>
  );
}
