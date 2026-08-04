import { useMemo, useState } from 'react';
import { where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import { ErrorBanner, Field } from '../../components/ui';
import { useMyChildren } from '../../hooks/useMyChildren';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { SCHOOL_NAME_AR } from '../../lib/constants';
import { GENERAL_MESSAGE_TEMPLATE, openWhatsAppChat, parseStoredPhone } from '../../lib/phone';
import { relativeFromTimestamp } from '../../lib/relativeTime';
import { submitAbsenceExcuse } from '../../services/aid';
import { demoStudentDetail, demoTeacherProfiles } from '../../data/demo';

const REASONS = ['مرض', 'ظرف عائلي', 'نزوح / ظرف طارئ', 'موعد طبي', 'أخرى'];
const STATUS_TONE = { 'قيد المراجعة': 'outline', 'مقبول': 'accent', 'مرفوض': 'accent2' };

export default function ParentAbsence() {
  const { profile, children, error, demo } = useMyChildren();
  const { data: teachers } = useLiveOrDemo('teacherProfiles', [], demoTeacherProfiles);
  const { data: excusesRaw } = useLiveOrDemo(
    'absenceExcuses',
    [where('guardianUid', '==', profile?.id || '__none__')],
    [],
    profile?.id || '__none__',
  );
  const excuses = useMemo(() => {
    const list = [...(excusesRaw || [])];
    list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    return list;
  }, [excusesRaw]);

  const [showForm, setShowForm] = useState(false);
  const [msgTeacher, setMsgTeacher] = useState(null);

  return (
    <div className="stu-page">
      <ErrorBanner>{error && 'تعذّر تحميل بيانات الأبناء.'}</ErrorBanner>
      <header className="stu-page-head">
        <h1 className="stu-page-title">تبرير الغياب</h1>
        <p className="stu-page-lead">أرسل تبرير غياب للإدارة، أو راسل معلّم الصف عبر واتساب.</p>
      </header>

      <div className="stu-actions-row">
        <button type="button" className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => setShowForm(true)}>
          <Icon name="event_available" size={14} /> طلب تبرير غياب
        </button>
      </div>

      <section className="card">
        <h2 className="card-title" style={{ marginBottom: 8 }}>طلباتي السابقة</h2>
        {excuses.length === 0 && <p className="stu-empty">لا طلبات تبرير بعد.</p>}
        {excuses.map((ex) => (
          <div key={ex.id} className="stu-class-row">
            <div className="stu-class-icon"><Icon name="event_busy" size={16} /></div>
            <div className="stu-class-body">
              <div className="stu-class-name">{ex.studentName || 'ابن/ة'} · {ex.date}</div>
              <div className="stu-class-meta">{ex.reason}{ex.note ? ` — ${ex.note}` : ''}</div>
            </div>
            <span className={`tag tag-${STATUS_TONE[ex.status] || 'neutral'}`}>{ex.status || 'قيد المراجعة'}</span>
            <span className="stu-feed-time">{relativeFromTimestamp(ex.createdAt)}</span>
          </div>
        ))}
      </section>

      <ChildTeachersBlock
        childrenList={children}
        teachers={teachers || []}
        demo={demo}
        onMessage={setMsgTeacher}
      />

      {showForm && (
        <ExcuseModal
          childrenList={children}
          demo={demo}
          profile={profile}
          onClose={() => setShowForm(false)}
        />
      )}
      {msgTeacher && (
        <TeacherWhatsAppModal
          teacher={msgTeacher}
          guardianName={profile?.name}
          onClose={() => setMsgTeacher(null)}
        />
      )}
    </div>
  );
}

function ChildTeachersBlock({ childrenList, teachers, demo, onMessage }) {
  // Load first child's classes for teacher ids — multi-child: merge all via hooks for first 3
  const id0 = childrenList[0]?.id;
  const id1 = childrenList[1]?.id;
  const id2 = childrenList[2]?.id;
  const { data: classes0 } = useLiveOrDemo(
    id0 ? `students/${id0}/classes` : '__none__',
    [],
    (demoStudentDetail[id0] || demoStudentDetail.s1)?.classes || [],
    id0 || '__none__',
  );
  const { data: classes1 } = useLiveOrDemo(
    id1 ? `students/${id1}/classes` : '__none__',
    [],
    (demoStudentDetail[id1]?.classes) || [],
    id1 || '__none__',
  );
  const { data: classes2 } = useLiveOrDemo(
    id2 ? `students/${id2}/classes` : '__none__',
    [],
    [],
    id2 || '__none__',
  );

  const linkedTeachers = useMemo(() => {
    const ids = new Set();
    const names = new Set();
    [...(classes0 || []), ...(classes1 || []), ...(classes2 || [])].forEach((cl) => {
      if (cl.teacherId) ids.add(cl.teacherId);
      if (cl.teacher || cl.teacherName) names.add(cl.teacher || cl.teacherName);
    });
    let list = (teachers || []).filter((t) => ids.has(t.id) || names.has(t.name));
    if (list.length === 0 && demo) list = (teachers || []).slice(0, 5);
    if (list.length === 0) {
      // Fallback: teachers mentioned on class mirrors without profiles
      const fromClasses = [...(classes0 || []), ...(classes1 || []), ...(classes2 || [])]
        .filter((cl) => cl.teacher || cl.teacherName)
        .map((cl) => ({
          id: cl.teacherId || cl.teacher || cl.teacherName,
          name: cl.teacher || cl.teacherName,
          subject: cl.subject,
          phone: cl.teacherPhone || '',
        }));
      const seen = new Set();
      list = fromClasses.filter((t) => {
        if (seen.has(t.name)) return false;
        seen.add(t.name);
        return true;
      });
    }
    return list;
  }, [classes0, classes1, classes2, teachers, demo]);

  return (
    <section className="card">
      <h2 className="card-title" style={{ marginBottom: 8 }}>مراسلة معلّم الصف</h2>
      <p className="stu-empty" style={{ marginBottom: 10 }}>
        يفتح واتساب على جهازك مع رسالة جاهزة (بدون واتساب بزنس).
      </p>
      {linkedTeachers.length === 0 && <p className="stu-empty">لا معلّمين مرتبطين بصفوف أبنائك بعد.</p>}
      {linkedTeachers.map((t) => (
        <div key={t.id || t.name} className="stu-class-row">
          <div className="stu-class-icon"><Icon name="person" size={16} /></div>
          <div className="stu-class-body">
            <div className="stu-class-name">{t.name}</div>
            <div className="stu-class-meta">{t.subject || t.spec || ''}</div>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: 12 }}
            disabled={!t.phone}
            onClick={() => onMessage(t)}
          >
            واتساب
          </button>
        </div>
      ))}
    </section>
  );
}

function ExcuseModal({ childrenList, demo, profile, onClose }) {
  const [studentId, setStudentId] = useState(childrenList[0]?.id || '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const student = childrenList.find((c) => c.id === studentId);
  const { data: studentClasses } = useLiveOrDemo(
    studentId ? `students/${studentId}/classes` : '__none__',
    [],
    (demoStudentDetail[studentId] || demoStudentDetail.s1)?.classes || [],
    studentId || '__none__',
  );

  const onSubmit = async (e) => {
    e.preventDefault();
    if (demo) { setError('وضع العرض التوضيحي: صِل Firebase لإرسال التبرير.'); return; }
    if (!studentId) { setError('اختر ابناً.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const teacherIds = [...new Set((studentClasses || []).map((c) => c.teacherId).filter(Boolean))];
      await submitAbsenceExcuse({
        studentId,
        studentName: student?.name,
        guardianUid: profile?.id,
        guardianName: profile?.name,
        date,
        reason,
        note,
        teacherIds,
      });
      onClose();
    } catch {
      setError('تعذّر إرسال الطلب.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="تبرير غياب" onClose={onClose} onSubmit={onSubmit} submitLabel="إرسال" submitting={submitting} error={error}>
      <Field label="الابن/ة">
        <select className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          {childrenList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="تاريخ الغياب">
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required dir="ltr" />
      </Field>
      <Field label="السبب">
        <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
          {REASONS.map((r) => <option key={r}>{r}</option>)}
        </select>
      </Field>
      <Field label="تفاصيل (اختياري)">
        <textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
      </Field>
    </Modal>
  );
}

function TeacherWhatsAppModal({ teacher, guardianName, onClose }) {
  const [text, setText] = useState(
    `${GENERAL_MESSAGE_TEMPLATE(SCHOOL_NAME_AR, guardianName)}\nأرغب بالتواصل بخصوص ابني/ابنتي.`,
  );
  const parsed = parseStoredPhone(teacher.phone || '', '970');

  return (
    <Modal
      title={`واتساب — ${teacher.name}`}
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        openWhatsAppChat(parsed, text);
        onClose();
      }}
      submitLabel="فتح واتساب"
    >
      <Field label="الرسالة">
        <textarea className="input" rows={5} value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
    </Modal>
  );
}
