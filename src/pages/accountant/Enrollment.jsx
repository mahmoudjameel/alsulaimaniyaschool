import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { orderBy } from 'firebase/firestore';
import Icon from '../../components/Icon';
import BackButton from '../../components/BackButton';
import SearchInput from '../../components/SearchInput';
import ClassScheduleLines from '../../components/ClassScheduleLines';
import { ErrorBanner } from '../../components/ui';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { demoClasses, demoEnrollments, demoStudents } from '../../data/demo';
import { enrollStudent, unenrollStudent } from '../../services/academics';
import { logActivity } from '../../services/activity';
import { useAuth } from '../../context/AuthContext';
import { staffPortalBase } from '../../lib/portalPaths';
import { filterByStudentSearch } from '../../lib/studentSearch';

export default function Enrollment() {
  const { pathname } = useLocation();
  const { profile } = useAuth();
  const backTo = staffPortalBase(pathname);
  const backLabel = backTo === '/admin' ? 'عودة للوحة الإدارة'
    : backTo === '/reception' ? 'عودة للوحة الاستقبال'
      : 'عودة للوحة المحاسب';

  const { data: classes, error: classesError, demo } = useLiveOrDemo('classes', [orderBy('createdAt', 'desc')], demoClasses);
  const { data: students, error: studentsError } = useLiveOrDemo('students', [orderBy('name', 'asc')], demoStudents);
  const [classId, setClassId] = useState('');
  const [demoEnrolled, setDemoEnrolled] = useState(demoEnrollments);
  const [addSearch, setAddSearch] = useState('');
  const [rosterSearch, setRosterSearch] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const activeClassId = classId || classes[0]?.id || '';
  const activeClass = classes.find((c) => c.id === activeClassId);

  const enrolledLive = useLiveOrDemo(
    activeClassId ? `classes/${activeClassId}/enrollments` : '__none__',
    [orderBy('enrolledAt', 'asc')],
    demoEnrolled[activeClassId] || [],
  );
  const enrolled = enrolledLive.data;
  const enrolledView = useMemo(() => filterByStudentSearch(enrolled, rosterSearch), [enrolled, rosterSearch]);

  const availableStudents = useMemo(() => {
    const enrolledIds = new Set(enrolled.map((e) => e.studentId || e.id));
    const pool = students.filter((s) => (
      !enrolledIds.has(s.id)
      && s.status !== 'متخرّج'
      && s.status !== 'منسحب'
    ));
    return filterByStudentSearch(pool, addSearch);
  }, [students, enrolled, addSearch]);

  const selectClass = (id) => {
    setClassId(id);
    setAddSearch('');
    setRosterSearch('');
    setError('');
    setOkMsg('');
  };

  const onEnroll = async (student) => {
    if (!student || !activeClass) return;
    setBusyId(student.id);
    setError('');
    setOkMsg('');
    try {
      if (demo) {
        setDemoEnrolled((s) => ({
          ...s,
          [activeClassId]: [
            ...(s[activeClassId] || []),
            {
              studentId: student.id,
              studentName: student.name,
              displayId: student.displayId,
              nationalId: student.nationalId,
              grade: student.grade,
              initial: student.initial || (student.name || 'ط').charAt(0),
            },
          ],
        }));
      } else {
        await enrollStudent(activeClassId, activeClass, student);
        await logActivity({
          type: 'enrollment_added',
          actorUid: profile?.id,
          actorName: profile?.name,
          actorRole: profile?.role,
          summary: `تسجيل ${student.name} في صفّ ${activeClass.title}`,
          targetType: 'class',
          targetId: activeClassId,
        });
      }
      setOkMsg(`تم تسجيل ${student.name}`);
      setAddSearch('');
    } catch {
      setError('تعذّر تسجيل الطالب في الصف.');
    } finally {
      setBusyId(null);
    }
  };

  const onRemove = async (studentId, studentName) => {
    setBusyId(studentId);
    setError('');
    setOkMsg('');
    try {
      if (demo) {
        setDemoEnrolled((s) => ({
          ...s,
          [activeClassId]: (s[activeClassId] || []).filter((e) => (e.studentId || e.id) !== studentId),
        }));
      } else {
        await unenrollStudent(activeClassId, studentId);
      }
      setOkMsg(studentName ? `أُزيل ${studentName} من الصف` : 'أُزيل الطالب من الصف');
    } catch {
      setError('تعذّر إزالة الطالب.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="enroll-page">
      <BackButton to={backTo} label={backLabel} />
      <ErrorBanner>{(classesError || studentsError) && 'تعذّر تحميل الصفوف أو الطلاب.'}</ErrorBanner>

      <header className="enroll-hero">
        <div>
          <h2 className="enroll-hero-title">تسجيل في الصفوف</h2>
          <p className="enroll-hero-sub">اختر الصف، ابحث عن الطالب، ثم أضفه. الطلاب الجدد يُوزَّعون تلقائياً عند التسجيل حسب المرحلة والشعبة.</p>
        </div>
        {activeClass && (
          <div className="enroll-hero-stat">
            <span className="enroll-hero-stat-num">{enrolled.length}</span>
            <span className="enroll-hero-stat-lbl">مسجّل حالياً</span>
          </div>
        )}
      </header>

      {/* Step 1: pick class */}
      <section className="enroll-section" aria-label="اختيار الصف">
        <div className="enroll-step">
          <span className="enroll-step-num">1</span>
          <div>
            <div className="enroll-step-title">اختر الصف</div>
            <div className="enroll-step-hint">المادة والمعلّم والأوقات تظهر أسفل كل صف</div>
          </div>
        </div>
        <div className="enroll-class-rail">
          {classes.length === 0 && (
            <div className="enroll-empty">لا توجد صفوف بعد. أنشئ صفّاً من لوحة الإدارة أولاً.</div>
          )}
          {classes.map((c) => {
            const active = c.id === activeClassId;
            return (
              <button
                key={c.id}
                type="button"
                className="enroll-class-chip"
                data-active={active}
                onClick={() => selectClass(c.id)}
              >
                <span className="enroll-class-chip-title">{c.title}</span>
                <span className="enroll-class-chip-meta">
                  {[c.grade, c.classSection ? `شعبة ${c.classSection}` : null, c.shift].filter(Boolean).join(' · ') || '—'}
                </span>
                <ClassScheduleLines
                  cls={c}
                  empty="بدون جدول حصص"
                  style={{ marginTop: 6, textAlign: 'right' }}
                />
              </button>
            );
          })}
        </div>
      </section>

      {activeClass && (
        <>
          {(error || okMsg) && (
            <div className={`enroll-toast ${error ? 'enroll-toast--err' : 'enroll-toast--ok'}`}>
              <Icon name={error ? 'error' : 'check_circle'} size={16} />
              {error || okMsg}
            </div>
          )}

          <div className="enroll-workspace ah-2col">
            {/* Step 2: add student */}
            <section className="enroll-panel" aria-label="إضافة طالب">
              <div className="enroll-step">
                <span className="enroll-step-num">2</span>
                <div>
                  <div className="enroll-step-title">أضف طالباً</div>
                  <div className="enroll-step-hint">ابحث بالاسم أو رقم الهوية ثم اضغط «إضافة»</div>
                </div>
              </div>

              <SearchInput
                value={addSearch}
                onChange={setAddSearch}
                placeholder="اسم الطالب أو رقم الهوية أو الرقم الدراسي…"
                style={{ maxWidth: '100%' }}
                autoFocus
              />

              <div className="enroll-list">
                {availableStudents.length === 0 && (
                  <div className="enroll-empty">
                    {addSearch.trim()
                      ? 'لا طلاب مطابقون — جرّب اسماً أو رقماً آخر.'
                      : 'كل الطلاب النشطين مسجّلون في هذا الصف، أو لا يوجد طلاب بعد.'}
                  </div>
                )}
                {availableStudents.slice(0, 40).map((s) => (
                  <div key={s.id} className="enroll-row">
                    <div className="enroll-avatar">{s.initial || (s.name || 'ط').charAt(0)}</div>
                    <div className="enroll-row-main">
                      <div className="enroll-row-name">{s.name}</div>
                      <div className="enroll-row-meta ah-tabnum">
                        {s.displayId || '—'}
                        {s.nationalId ? ` · هوية ${s.nationalId}` : ''}
                        {s.grade ? ` · ${s.grade}` : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ fontSize: 12, flex: 'none' }}
                      disabled={busyId === s.id}
                      onClick={() => onEnroll(s)}
                    >
                      <Icon name="person_add" size={14} />
                      {busyId === s.id ? '…' : 'إضافة'}
                    </button>
                  </div>
                ))}
                {availableStudents.length > 40 && (
                  <div className="enroll-empty">يُعرض أول 40 نتيجة — ضيّق البحث.</div>
                )}
              </div>
            </section>

            {/* Step 3: roster */}
            <section className="enroll-panel" aria-label="الطلاب المسجّلون">
              <div className="enroll-step">
                <span className="enroll-step-num">3</span>
                <div>
                  <div className="enroll-step-title">
                    المسجّلون في «{activeClass.title}»
                    <span className="enroll-count">{enrolled.length}</span>
                  </div>
                  <div className="enroll-step-hint">يمكنك إزالة طالب من الصف عند الحاجة</div>
                </div>
              </div>

              {enrolled.length > 4 && (
                <SearchInput
                  value={rosterSearch}
                  onChange={setRosterSearch}
                  placeholder="تصفية المسجّلين…"
                  style={{ maxWidth: '100%' }}
                />
              )}

              <div className="enroll-list">
                {enrolledView.length === 0 && (
                  <div className="enroll-empty">
                    {rosterSearch.trim()
                      ? 'لا نتائج في قائمة المسجّلين.'
                      : 'لا أحد مسجّل بعد — أضف طالباً من القائمة المجاورة.'}
                  </div>
                )}
                {enrolledView.map((e, i) => {
                  const sid = e.studentId || e.id;
                  return (
                    <div key={sid || i} className="enroll-row">
                      <div className="enroll-avatar enroll-avatar--soft">
                        {(e.studentName || e.name || 'ط').charAt(0)}
                      </div>
                      <div className="enroll-row-main">
                        <div className="enroll-row-name">{e.studentName || e.name}</div>
                        <div className="enroll-row-meta ah-tabnum">
                          {e.displayId || '—'}
                          {e.grade ? ` · ${e.grade}` : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ fontSize: 12, color: 'var(--color-accent-2-700)' }}
                        disabled={busyId === sid}
                        onClick={() => onRemove(sid, e.studentName || e.name)}
                      >
                        {busyId === sid ? '…' : 'إزالة'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
