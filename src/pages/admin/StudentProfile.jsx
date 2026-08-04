import { useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { orderBy } from 'firebase/firestore';
import Icon from '../../components/Icon';
import BackButton from '../../components/BackButton';
import { EmptyRow, ErrorBanner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useDocOrDemo, useLiveOrDemo } from '../../hooks/useFirestore';
import { demoStudents, demoStudentDetail, demoAttendanceRecords } from '../../data/demo';
import { formatILS, SCHOOL_NAME_AR } from '../../lib/constants';
import { relativeDaysAr, relativeFromTimestamp } from '../../lib/relativeTime';
import { computeAttendanceRate, computeMonthlyAttendance } from '../../lib/attendance';
import EditStudentModal from '../../modals/EditStudentModal';
import { FEE_REMINDER_TEMPLATE, GENERAL_MESSAGE_TEMPLATE, openWhatsAppChat, parseStoredPhone } from '../../lib/phone';
import { studentsListPath, staffPortalBase } from '../../lib/portalPaths';
import { sendAdminStudentAlert } from '../../services/staffRequests';

const TABS = [
  { id: 'overview', label: 'نظرة عامة' }, { id: 'guardians', label: 'أولياء الأمور' },
  { id: 'finance', label: 'المالية' }, { id: 'docs', label: 'المستندات' },
  { id: 'classes', label: 'الصفوف' }, { id: 'attendance', label: 'الحضور' },
  { id: 'notes', label: 'الملاحظات' },
];

export default function StudentProfile() {
  const { id } = useParams();
  const { pathname } = useLocation();
  const { profile } = useAuth();
  const portalBase = staffPortalBase(pathname);
  const [tab, setTab] = useState('overview');
  const [editing, setEditing] = useState(false);
  const [alertText, setAlertText] = useState('');
  const [alertMsg, setAlertMsg] = useState('');
  const [alertBusy, setAlertBusy] = useState(false);

  const { data: student, demo } = useDocOrDemo(`students/${id}`, demoStudents.find((s) => s.id === id) || demoStudents[0]);
  const detail = demo ? (demoStudentDetail[id] || demoStudentDetail.s1) : null;

  const ledger = useLiveOrDemo(`students/${id}/ledger`, [orderBy('date', 'asc')], detail?.ledger || []);
  const documents = useLiveOrDemo(`students/${id}/documents`, [orderBy('date', 'desc')], detail?.documents || []);
  const attendance = useLiveOrDemo(`students/${id}/attendanceRecords`, [orderBy('date', 'desc')], demoAttendanceRecords[id] || []);
  const notes = useLiveOrDemo(`students/${id}/notes`, [orderBy('createdAt', 'desc')], detail?.notes || []);
  const guardians = useLiveOrDemo(`students/${id}/guardians`, [orderBy('createdAt', 'asc')], detail?.guardians || []);
  const classesList = useLiveOrDemo(`students/${id}/classes`, [orderBy('createdAt', 'asc')], detail?.classes || []);

  const monthlyAttendance = useMemo(() => computeMonthlyAttendance(attendance.data), [attendance.data]);
  const attendanceRate = useMemo(() => computeAttendanceRate(attendance.data), [attendance.data]);

  if (!student) return <ErrorBanner>تعذّر العثور على هذا الطالب.</ErrorBanner>;

  const finance = detail?.finance;
  const dueMinorUnits = finance
    ? finance.billedMinorUnits - finance.collectedMinorUnits - finance.discountMinorUnits
    : (student.balanceMinorUnits ?? 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <BackButton to={studentsListPath(pathname)} label="عودة لقائمة الطلاب" />
      <div className="ah-profile-head" style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <div style={{ width: 88, height: 88, flex: 'none', borderRadius: 'var(--radius-md)', background: 'var(--color-accent-100)', color: 'var(--color-accent-800)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-heading)', fontSize: 34 }}>{student.initial}</div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 30 }}>{student.name}</h2>
            <span className={`tag ${student.status === 'نشط' ? 'tag-accent' : 'tag-neutral'}`}>{student.status}</span>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13, color: 'var(--color-neutral-600)', marginTop: 8 }} className="ah-tabnum">
            <span>الرقم: {student.displayId}</span>
            <span>الصف: {student.grade}</span>
            {student.nationalId && <span>الهوية: {student.nationalId}</span>}
            {(student.ageYears || detail?.age) && <span>العمر: {student.ageYears || detail?.age}</span>}
            {student.academicYear && <span>العام: {student.academicYear}</span>}
            {detail?.joinedDate && <span>تاريخ الالتحاق: {detail.joinedDate}</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            <span className={`tag ${student.studentUid ? 'tag-accent' : 'tag-outline'}`} style={{ fontSize: 10 }}>
              بوابة الطالب: {student.studentUid ? 'مربوطة' : 'تنتظر أول دخول بالرقم الدراسي'}
            </span>
            <span className={`tag ${student.guardianUid ? 'tag-accent' : 'tag-outline'}`} style={{ fontSize: 10 }}>
              ولي الأمر: {student.guardianUid ? 'مربوط' : (student.guardianPhoneKey || student.guardianPhoneLocal ? 'عبر الهاتف عند أول دخول' : 'لا هاتف مسجّل')}
            </span>
            {classesList.data.length > 0 && (
              <span className="tag tag-neutral" style={{ fontSize: 10 }}>{classesList.data.length} صف مسجّل</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" style={{ fontSize: 13 }} onClick={() => setEditing(true)}>
            <Icon name="edit" size={14} /> تعديل البيانات
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: 13 }}
            onClick={() => openWhatsAppChat(
              parseStoredPhone(student),
              FEE_REMINDER_TEMPLATE(SCHOOL_NAME_AR, student.name, formatILS(student.balanceMinorUnits)),
            )}
          >
            <Icon name="chat" size={14} /> واتساب ولي الأمر
          </button>
          <button type="button" className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => window.open(`${portalBase}/students/${id}/report-card`, '_blank')}>
            <Icon name="print" size={14} /> طباعة كشف العلامات
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
          <input
            className="input"
            style={{ flex: 1, minWidth: 200 }}
            value={alertText}
            onChange={(e) => setAlertText(e.target.value)}
            placeholder="تنبيه سريع لمعلّمي صفوف هذا الطالب…"
          />
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: 13 }}
            disabled={alertBusy || !alertText.trim()}
            onClick={async () => {
              const teacherIds = [...new Set((classesList.data || []).map((c) => c.teacherId).filter(Boolean))];
              if (teacherIds.length === 0) {
                setAlertMsg('لا معلّمين مرتبطين بصفوف الطالب.');
                return;
              }
              if (demo) {
                setAlertMsg('وضع العرض: صِل Firebase.');
                return;
              }
              setAlertBusy(true);
              setAlertMsg('');
              try {
                await sendAdminStudentAlert({
                  teacherIds,
                  adminId: profile?.id,
                  adminName: profile?.name,
                  studentId: id,
                  studentName: student.name,
                  message: alertText.trim(),
                });
                setAlertMsg(`أُرسل لمعلّمين: ${teacherIds.length}`);
                setAlertText('');
              } catch {
                setAlertMsg('تعذّر الإرسال.');
              } finally {
                setAlertBusy(false);
              }
            }}
          >
            <Icon name="campaign" size={14} /> تنبيه المعلّمين
          </button>
          {alertMsg && <span style={{ fontSize: 12, color: 'var(--color-accent-700)' }}>{alertMsg}</span>}
        </div>
      </div>

      {editing && (
        <EditStudentModal
          student={student}
          demo={demo}
          onClose={() => setEditing(false)}
        />
      )}

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '9px 16px', fontSize: 13, border: 0, borderBottom: `2px solid ${tab === t.id ? 'var(--gold)' : 'transparent'}`, color: tab === t.id ? 'var(--gold)' : 'var(--color-neutral-600)', cursor: 'pointer', background: 'transparent', fontFamily: 'var(--font-body)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="ah-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          <div className="card"><span className="card-kicker">الصفوف المسجّلة</span><div className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 30, color: 'var(--gold)' }}>{classesList.data.length}</div><div className="card-meta">من التسجيل الأكاديمي</div></div>
          <div className="card"><span className="card-kicker">نسبة الحضور</span><div className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 30, color: 'var(--gold)' }}>{attendanceRate != null ? `${attendanceRate}%` : '—'}</div><div className="card-meta">من إجمالي السجلّات</div></div>
          <div className="card"><span className="card-kicker">المستحق المالي</span><div className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 30, color: 'var(--gold)' }}>{formatILS(dueMinorUnits)}</div><div className="card-meta">{finance ? `من أصل ${formatILS(finance.billedMinorUnits)}` : 'من رصيد الطالب'}</div></div>
          <div className="card"><span className="card-kicker">الملاحظات</span><div className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 30, color: 'var(--gold)' }}>{notes.data.length}</div><div className="card-meta">من معلّمي الصف</div></div>
        </div>
      )}

      {tab === 'guardians' && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 6 }}>أولياء الأمور</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {guardians.data.length === 0 && !(student.guardianName || student.guardianPhone) && (
              <div style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>لا يوجد أولياء أمور مسجّلون.</div>
            )}
            {guardians.data.length === 0 && (student.guardianName || student.guardianPhone) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-neutral-200)', display: 'grid', placeItems: 'center' }}><Icon name="person" size={15} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13 }}>{student.guardianName || 'ولي أمر'} <span className="tag tag-accent" style={{ fontSize: 9 }}>جهة الاتصال الأساسية</span></div>
                  <div style={{ fontSize: 11, color: 'var(--color-neutral-500)' }} dir="ltr">{student.guardianPhoneE164 || student.guardianPhone || '—'}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-neutral-500)', marginTop: 2 }}>
                    {student.guardianUid ? 'حساب البوابة مربوط' : 'سيربط عند أول دخول برقم الهاتف'}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: 12 }}
                  onClick={() => openWhatsAppChat(parseStoredPhone(student), GENERAL_MESSAGE_TEMPLATE(SCHOOL_NAME_AR, student.guardianName))}
                >
                  واتساب
                </button>
              </div>
            )}
            {guardians.data.map((g, i) => (
              <div key={g.id || i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < guardians.data.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-neutral-200)', display: 'grid', placeItems: 'center' }}><Icon name="person" size={15} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13 }}>{g.name} {g.primary && <span className="tag tag-accent" style={{ fontSize: 9 }}>جهة الاتصال الأساسية</span>}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>{g.relation} · {g.phone}</div>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: 12 }}
                  onClick={() => openWhatsAppChat(parseStoredPhone(g.phone || student), GENERAL_MESSAGE_TEMPLATE(SCHOOL_NAME_AR, g.name))}
                >
                  واتساب
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'finance' && (
        <>
          <div className="card">
            <div className="card-title" style={{ marginBottom: 6 }}>ملخّص مالي</div>
            {finance ? (
              <>
                <Row label="إجمالي المفوتر (الفصل)" value={formatILS(finance.billedMinorUnits)} />
                <Row label="المحصّل" value={formatILS(finance.collectedMinorUnits)} color="var(--color-accent-700)" />
                <Row label="منحة" value={`− ${formatILS(finance.discountMinorUnits)}`} />
                <Row label="المستحق" value={formatILS(dueMinorUnits)} big />
              </>
            ) : (
              <>
                <Row label="الرصيد المستحق حالياً" value={formatILS(student.balanceMinorUnits ?? 0)} big />
                <div style={{ fontSize: 12, color: 'var(--color-neutral-500)', marginTop: 6 }}>يُحدَّث تلقائياً من الفواتير والدفعات المعتمدة.</div>
              </>
            )}
          </div>
          <div className="card">
            <div className="card-title" style={{ marginBottom: 8 }}>دفتر الحساب — سجل زمني</div>
            <table className="table">
              <thead><tr><th>التاريخ</th><th>البند</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead>
              <tbody>
                {ledger.data.length === 0 && <EmptyRow colSpan={5}>لا توجد حركات بعد.</EmptyRow>}
                {ledger.data.map((l, i) => (
                  <tr key={i}>
                    <td className="ah-tabnum" style={{ color: 'var(--color-neutral-500)' }}>{l.date}</td>
                    <td>{l.item}</td>
                    <td className="ah-tabnum">{l.debitMinorUnits ? formatILS(l.debitMinorUnits) : '—'}</td>
                    <td className="ah-tabnum" style={{ color: 'var(--color-accent-700)' }}>{l.creditMinorUnits ? formatILS(l.creditMinorUnits) : '—'}</td>
                    <td className="ah-tabnum">{formatILS(l.balanceMinorUnits)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'docs' && (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>المستند</th><th>النوع</th><th>التاريخ</th><th>الحالة</th><th></th></tr></thead>
            <tbody>
              {documents.data.length === 0 && <EmptyRow colSpan={5}>لا توجد مستندات مرفوعة.</EmptyRow>}
              {documents.data.map((d, i) => (
                <tr key={i}>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="description" size={16} color="var(--gold)" />{d.name}</div></td>
                  <td className="ah-tabnum" style={{ color: 'var(--color-neutral-500)' }}>{d.type}</td>
                  <td className="ah-tabnum" style={{ color: 'var(--color-neutral-500)' }}>{d.date}</td>
                  <td><span className={`tag tag-${d.tone}`}>{d.status}</span></td>
                  <td style={{ textAlign: 'left' }}><button className="btn btn-ghost" style={{ fontSize: 12 }}>تنزيل</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'classes' && (
        <div className="ah-3col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {classesList.data.length === 0 && <div style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>الطالب غير مسجّل في أي صف بعد.</div>}
          {classesList.data.map((c, i) => (
            <div key={i} className="card">
              <span className="tag tag-outline" style={{ alignSelf: 'flex-start' }}>{c.subject}</span>
              <div className="card-title" style={{ fontSize: 16 }}>{c.title}</div>
              <div className="card-meta">{c.teacher}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>التقدير</span>
                <span className="tag tag-accent">{c.grade}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'attendance' && (
        <>
          <div className="card" style={{ padding: 0, marginBottom: 16 }}>
            <div className="card-title" style={{ padding: '14px 14px 0' }}>ملخّص شهري</div>
            <table className="table" style={{ marginTop: 8 }}>
              <thead><tr><th>الشهر</th><th>حضور</th><th>غياب</th><th>تأخّر</th><th>استئذان</th><th>النسبة</th></tr></thead>
              <tbody>
                {monthlyAttendance.length === 0 && <EmptyRow colSpan={6}>لا توجد سجلّات حضور بعد.</EmptyRow>}
                {monthlyAttendance.map((a) => (
                  <tr key={a.key}>
                    <td>{a.label}</td>
                    <td className="ah-tabnum" style={{ color: 'var(--color-accent-700)' }}>{a.present}</td>
                    <td className="ah-tabnum">{a.absent}</td>
                    <td className="ah-tabnum" style={{ color: 'var(--color-neutral-500)' }}>{a.late}</td>
                    <td className="ah-tabnum" style={{ color: 'var(--color-neutral-500)' }}>{a.excused}</td>
                    <td className="ah-tabnum" style={{ color: 'var(--gold)' }}>{a.pct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card" style={{ padding: 0 }}>
            <div className="card-title" style={{ padding: '14px 14px 0' }}>السجلّ التفصيلي</div>
            <table className="table" style={{ marginTop: 8 }}>
              <thead><tr><th>التاريخ</th><th>الصف</th><th>الحالة</th></tr></thead>
              <tbody>
                {attendance.data.length === 0 && <EmptyRow colSpan={3}>لا توجد سجلّات حضور بعد.</EmptyRow>}
                {attendance.data.map((a, i) => (
                  <tr key={a.id || i}>
                    <td className="ah-tabnum" style={{ color: 'var(--color-neutral-500)' }}>{a.date}</td>
                    <td>{a.className} <span style={{ color: 'var(--color-neutral-500)', fontSize: 12 }}>· {a.subject}</span></td>
                    <td><span className={`tag ${a.status === 'حاضر' ? 'tag-accent' : a.status === 'غائب' ? 'tag-accent-2' : 'tag-neutral'}`}>{a.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'notes' && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 8 }}>ملاحظات المعلّمين</div>
          {notes.data.length === 0 && <div style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>لا توجد ملاحظات بعد.</div>}
          {notes.data.map((n, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
              <div style={{ width: 34, height: 34, flex: 'none', borderRadius: '50%', background: 'var(--color-neutral-200)', display: 'grid', placeItems: 'center' }}><Icon name="chat" size={16} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className="tag tag-neutral" style={{ fontSize: 9 }}>{n.kind}</span>
                  <span className={`tag ${n.sentiment === 'إيجابي' ? 'tag-accent' : 'tag-accent-2'}`} style={{ fontSize: 9 }}>{n.sentiment}</span>
                  <span style={{ marginInlineStart: 'auto', fontSize: 11, color: 'var(--color-neutral-500)' }}>{n.by} · {demo ? relativeDaysAr(n.daysAgo) : relativeFromTimestamp(n.createdAt)}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 4 }}>{n.note}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, color, big }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: big ? 15 : 13, padding: '6px 0', borderBottom: big ? 'none' : '1px solid var(--line)' }}>
      <span>{label}</span>
      <span className="ah-tabnum" style={{ color: color || (big ? 'var(--gold)' : undefined), fontFamily: big ? 'var(--font-heading)' : undefined, fontSize: big ? 20 : undefined }}>{value}</span>
    </div>
  );
}
