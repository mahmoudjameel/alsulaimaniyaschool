import { Fragment, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { orderBy } from 'firebase/firestore';
import Icon from '../../components/Icon';
import BackButton from '../../components/BackButton';
import SearchInput from '../../components/SearchInput';
import { EmptyRow, ErrorBanner } from '../../components/ui';
import { useDocOrDemo, useLiveOrDemo } from '../../hooks/useFirestore';
import { demoClasses, demoEnrollments, demoTeacherProfiles, demoAttendanceSessions } from '../../data/demo';
import { filterByStudentSearch } from '../../lib/studentSearch';
import EditClassModal from '../../modals/EditClassModal';
import { syncClassStudentsCount } from '../../services/academics';

export default function ClassDetail() {
  const { id } = useParams();
  const { data: cls, error, demo } = useDocOrDemo(`classes/${id}`, demoClasses.find((c) => c.id === id) || demoClasses[0]);
  const { data: enrolled } = useLiveOrDemo(`classes/${id}/enrollments`, [orderBy('enrolledAt', 'asc')], demoEnrollments[id] || []);
  const { data: teachers } = useLiveOrDemo('teacherProfiles', [], demoTeacherProfiles);
  const { data: sessions } = useLiveOrDemo(`classes/${id}/attendanceSessions`, [orderBy('date', 'desc')], demoAttendanceSessions[id] || []);
  const { data: dayLogs } = useLiveOrDemo(`classes/${id}/dayLogs`, [orderBy('date', 'desc')], []);
  const { data: lessons } = useLiveOrDemo(`classes/${id}/lessons`, [orderBy('order', 'asc')], []);
  const [openDate, setOpenDate] = useState(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const teacher = teachers.find((t) => t.id === cls?.teacherId);
  const classTeachers = useMemo(() => {
    const ids = new Set([
      ...(cls?.teacherIds || []),
      ...(cls?.schedule || []).map((s) => s.teacherId).filter(Boolean),
    ]);
    if (cls?.teacherId) ids.add(cls.teacherId);
    const fromProfiles = teachers.filter((t) => ids.has(t.id));
    if (fromProfiles.length) return fromProfiles;
    if (cls?.teacher) return [{ id: cls.teacherId || 'legacy', name: cls.teacher, subject: cls.subject }];
    return [];
  }, [cls, teachers]);
  const enrolledView = useMemo(() => filterByStudentSearch(enrolled, search), [enrolled, search]);
  const realCount = enrolled.length;

  const onSyncCount = async () => {
    if (demo || !id) return;
    try {
      const n = await syncClassStudentsCount(id);
      setSyncMsg(`تم مزامنة العدد: ${n} طالب`);
    } catch {
      setSyncMsg('تعذّرت المزامنة.');
    }
  };

  if (!cls) return <ErrorBanner>تعذّر العثور على هذا الصف.</ErrorBanner>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <ErrorBanner>{error && 'تعذّر تحميل بيانات الصف.'}</ErrorBanner>
      <BackButton to="/admin/classes" label="عودة للصفوف" />

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>{cls.title}</h2>
        <span className="tag tag-outline">{cls.subject}</span>
        {cls.grade && <span className="tag tag-neutral">{cls.grade}</span>}
        {cls.shift && <span className="tag tag-neutral">{cls.shift}</span>}
        <span className={`tag tag-${cls.tone || 'neutral'}`}>{cls.visibility}</span>
        <span className="tag tag-accent">{realCount} طالب مسجّل</span>
        <button type="button" className="btn btn-primary" style={{ fontSize: 13, marginInlineStart: 'auto' }} onClick={() => setEditing(true)}>
          <Icon name="edit" size={14} /> تعديل الصف والجدول
        </button>
        <Link to={`/admin/classes/${id}/grade-sheet`} className="btn btn-secondary" style={{ fontSize: 13, textDecoration: 'none' }}>
          <Icon name="print" size={14} /> كشف درجات للطباعة
        </Link>
        <Link to="/admin/grades" className="btn btn-secondary" style={{ fontSize: 13, textDecoration: 'none' }}>
          <Icon name="grade" size={14} /> اعتماد الدرجات
        </Link>
      </div>

      <div className="ah-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16, alignItems: 'start' }}>
        <div className="card">
          <div className="card-title" style={{ marginBottom: 8 }}>
            {classTeachers.length > 1 ? 'المعلّمون' : 'المعلّم'}
          </div>
          {classTeachers.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--color-neutral-600)' }}>غير معيّن</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {classTeachers.map((t) => (
                <div key={t.id} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-accent-100)', color: 'var(--color-accent-800)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-heading)', fontSize: 16, flex: 'none' }}>
                    {t.initial || (t.name || 'م').charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14 }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--gold)' }}>{t.subject || ''}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!cls.teacherId && !(cls.teacherIds || []).length && (
            <div style={{ fontSize: 12, color: 'var(--color-accent-2-700)', marginTop: 8 }}>
              لا يوجد معلّم بحساب دخول — عيّن معلّمين على الحصص حتى يظهر الصف في بواباتهم.
            </div>
          )}
          {teacher && classTeachers.length === 1 && (
            <Link to={`/admin/teachers/${teacher.id}`} className="btn btn-ghost" style={{ fontSize: 12, marginTop: 10, alignSelf: 'flex-start', textDecoration: 'none' }}>عرض ملف المعلّم ←</Link>
          )}
          <hr className="hr" />
          <div className="card-title" style={{ marginBottom: 8, fontSize: 15 }}>جدول الحصص الأسبوعي</div>
          {(cls.schedule || []).length === 0 && <div style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>لم يُحدَّد جدول بعد — عدّل الصف لإضافته.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(cls.schedule || []).map((s, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>{s.day}</span>
                  <span className="ah-tabnum" dir="ltr" style={{ color: 'var(--color-neutral-600)' }}>{s.start} – {s.end}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>
                  {[s.subject || cls.subject, s.teacherName || (s.teacherId && teachers.find((t) => t.id === s.teacherId)?.name) || cls.teacher]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
            ))}
          </div>
          {!demo && (
            <button type="button" className="btn btn-ghost" style={{ fontSize: 12, marginTop: 12, alignSelf: 'flex-start' }} onClick={onSyncCount}>
              مزامنة عدد الطلاب من التسجيل
            </button>
          )}
          {syncMsg && <div style={{ fontSize: 12, color: 'var(--color-accent-700)', marginTop: 6 }}>{syncMsg}</div>}
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '14px 14px 0', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="card-title" style={{ margin: 0 }}>الطلاب المسجّلون ({enrolledView.length}{search.trim() ? ` / ${enrolled.length}` : ''})</div>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="بحث في طلاب الصف…"
              style={{ marginInlineStart: 'auto', maxWidth: 260 }}
            />
          </div>
          <table className="table" style={{ marginTop: 8 }}>
            <thead><tr><th>الطالب</th><th>الرقم</th><th>الصف الدراسي</th></tr></thead>
            <tbody>
              {enrolledView.length === 0 && <EmptyRow colSpan={3}>{search.trim() ? 'لا نتائج مطابقة.' : 'لا يوجد طلاب مسجّلون في هذا الصف بعد.'}</EmptyRow>}
              {enrolledView.map((e, i) => (
                <tr key={e.studentId || e.id || i}>
                  <td>{e.studentName || e.name}</td>
                  <td className="ah-tabnum" style={{ color: 'var(--color-neutral-500)' }}>{e.displayId}</td>
                  <td>{e.grade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="card-title" style={{ padding: '14px 14px 0' }}>
          دروس المعلّم ({lessons.length})
        </div>
        <table className="table" style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th>العنوان</th>
              <th>الوحدة</th>
              <th>التاريخ</th>
              <th>الحالة</th>
              <th>واجب</th>
              <th>المعلّم</th>
            </tr>
          </thead>
          <tbody>
            {lessons.length === 0 && <EmptyRow colSpan={6}>لا دروس بعد لهذا الصف.</EmptyRow>}
            {lessons.map((l) => (
              <tr key={l.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{l.title || '—'}</div>
                  {l.whatTaught && (
                    <div style={{ fontSize: 12, color: 'var(--color-neutral-600)', marginTop: 2 }}>{l.whatTaught}</div>
                  )}
                </td>
                <td>{l.chapterTitle || '—'}</td>
                <td className="ah-tabnum">{l.scheduledFor || '—'}</td>
                <td>
                  <span className={`tag tag-${l.status === 'منشور' ? 'accent' : 'outline'}`}>
                    {l.status === 'قيد التحرير' ? 'مسودة' : (l.status || '—')}
                  </span>
                </td>
                <td>{l.isHomework ? 'نعم' : '—'}</td>
                <td>{l.authorName || cls.teacher || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="card-title" style={{ padding: '14px 14px 0' }}>دفتر اليوم (من بوابة المعلّم)</div>
        <table className="table" style={{ marginTop: 8 }}>
          <thead><tr><th>التاريخ</th><th>الموضوع</th><th>الواجب</th><th>تنبيه</th><th>المعلّم</th></tr></thead>
          <tbody>
            {dayLogs.length === 0 && <EmptyRow colSpan={5}>لا إدخالات في دفتر اليوم بعد.</EmptyRow>}
            {dayLogs.slice(0, 30).map((d) => (
              <tr key={d.id || d.date}>
                <td className="ah-tabnum">{d.date || d.id}</td>
                <td>{d.topic || '—'}</td>
                <td style={{ fontSize: 13 }}>{d.homework || '—'}</td>
                <td style={{ fontSize: 13 }}>{d.notice || '—'}</td>
                <td>{d.teacherName || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="card-title" style={{ padding: '14px 14px 0' }}>سجلّ الحضور والغياب</div>
        <table className="table" style={{ marginTop: 8 }}>
          <thead><tr><th>التاريخ</th><th>حاضر</th><th>غائب</th><th>متأخر / مستأذن</th><th>سجّله</th><th></th></tr></thead>
          <tbody>
            {sessions.length === 0 && <EmptyRow colSpan={6}>لم يُسجَّل حضور لهذا الصف بعد.</EmptyRow>}
            {sessions.map((s) => {
              const records = Object.values(s.records || {});
              const present = records.filter((r) => r.status === 'حاضر').length;
              const absent = records.filter((r) => r.status === 'غائب').length;
              const other = records.length - present - absent;
              const isOpen = openDate === s.date;
              return (
                <Fragment key={s.date}>
                  <tr onClick={() => setOpenDate(isOpen ? null : s.date)} style={{ cursor: 'pointer' }}>
                    <td className="ah-tabnum">{s.date}</td>
                    <td className="ah-tabnum" style={{ color: 'var(--color-accent-700)' }}>{present}</td>
                    <td className="ah-tabnum" style={{ color: 'var(--color-neutral-500)' }}>{absent}</td>
                    <td className="ah-tabnum" style={{ color: 'var(--color-neutral-500)' }}>{other}</td>
                    <td>{s.takenByName || '—'}</td>
                    <td style={{ textAlign: 'left' }}><Icon name={isOpen ? 'expand_less' : 'expand_more'} size={16} color="var(--color-neutral-400)" /></td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={6} style={{ padding: '8px 12px', background: 'var(--color-accent-100)' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {Object.entries(s.records || {}).map(([studentId, r]) => (
                            <span key={studentId} className={`tag ${r.status === 'حاضر' ? 'tag-accent' : r.status === 'غائب' ? 'tag-accent-2' : 'tag-neutral'}`}>{r.studentName} · {r.status}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditClassModal
          cls={cls}
          demo={demo}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
