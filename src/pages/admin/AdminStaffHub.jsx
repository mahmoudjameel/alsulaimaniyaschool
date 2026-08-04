import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { orderBy, where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { EmptyRow, ErrorBanner, SegmentedTabs } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { reviewStaffRequest, sendAdminStudentAlert } from '../../services/staffRequests';
import { approveClassExam, rejectClassExam } from '../../services/classExams';

export default function AdminStaffHub() {
  const { profile } = useAuth();
  const [tab, setTab] = useState('requests');
  const [busyId, setBusyId] = useState(null);
  const [alertStudentId, setAlertStudentId] = useState('');
  const [alertStudentName, setAlertStudentName] = useState('');
  const [alertTeacherIds, setAlertTeacherIds] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertMsg, setAlertMsg] = useState('');

  const { data: requests, error, demo } = useLiveOrDemo(
    'staffRequests',
    [orderBy('createdAt', 'desc')],
    [],
  );
  const { data: exams } = useLiveOrDemo(
    'classExams',
    [where('status', '==', 'قيد المراجعة')],
    [],
  );

  const pendingRequests = useMemo(() => (requests || []).filter((r) => r.status === 'قيد المراجعة'), [requests]);
  const decided = useMemo(() => (requests || []).filter((r) => r.status !== 'قيد المراجعة').slice(0, 30), [requests]);

  const decidedBy = { uid: profile?.id, name: profile?.name, role: profile?.role };

  const onReview = async (row, decision) => {
    if (demo) return;
    setBusyId(row.id);
    try {
      await reviewStaffRequest(row.id, {
        decision,
        reviewer: decidedBy,
        notifyTeacherId: row.teacherId,
        note: decision === 'approve' ? 'تمّت الموافقة من الإدارة.' : 'رُفض الطلب.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const onExam = async (exam, ok) => {
    if (demo) return;
    setBusyId(exam.id);
    try {
      if (ok) await approveClassExam(exam, decidedBy);
      else await rejectClassExam(exam, decidedBy);
    } finally {
      setBusyId(null);
    }
  };

  const onAlert = async (e) => {
    e.preventDefault();
    if (demo) { setAlertMsg('وضع العرض.'); return; }
    const ids = alertTeacherIds.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    if (!ids.length || !alertMessage.trim()) {
      setAlertMsg('أدخل معرّفات المعلّمين والرسالة.');
      return;
    }
    try {
      await sendAdminStudentAlert({
        teacherIds: ids,
        adminId: profile.id,
        adminName: profile.name,
        studentId: alertStudentId || null,
        studentName: alertStudentName || 'طالب',
        message: alertMessage.trim(),
      });
      setAlertMsg('أُرسل التنبيه للمعلّمين.');
      setAlertMessage('');
    } catch {
      setAlertMsg('تعذّر الإرسال.');
    }
  };

  const tabs = [
    { id: 'requests', label: `طلبات المعلّمين · ${pendingRequests.length}` },
    { id: 'exams', label: `اختبارات · ${(exams || []).length}` },
    { id: 'alert', label: 'تنبيه لمعلّم' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ErrorBanner>{error && 'تعذّر التحميل.'}</ErrorBanner>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)', lineHeight: 1.7 }}>
        اجتماعات أولياء الأمور، طلبات التغطية، اعتماد مواعيد الاختبارات، وتنبيهات للمعلّمين عن طالب.
      </p>

      <SegmentedTabs tabs={tabs.map((t) => ({ ...t, active: tab === t.id, onClick: () => setTab(t.id) }))} />

      {tab === 'requests' && (
        <>
          <div className="card ah-table-wrap" style={{ padding: 0 }}>
            <div className="card-title" style={{ padding: '14px 16px', margin: 0, borderBottom: '1px solid var(--line)' }}>قيد المراجعة</div>
            <table className="table">
              <thead><tr><th>النوع</th><th>المعلّم</th><th>التفاصيل</th><th></th></tr></thead>
              <tbody>
                {pendingRequests.length === 0 && <EmptyRow colSpan={4}>لا طلبات معلّقة.</EmptyRow>}
                {pendingRequests.map((r) => (
                  <tr key={r.id}>
                    <td>{r.kind === 'meeting' ? 'اجتماع ولي أمر' : 'تغطية/استبدال'}</td>
                    <td>{r.teacherName}</td>
                    <td style={{ fontSize: 13 }}>
                      {r.kind === 'meeting'
                        ? (
                          <>
                            <Link to={`/admin/students/${r.studentId}`}>{r.studentName}</Link>
                            {' — '}{r.reason}
                            {r.preferredTime ? ` · ${r.preferredTime}` : ''}
                          </>
                        )
                        : `${r.className} · ${r.date} · ${r.reason}${r.periodLabel ? ` · ${r.periodLabel}` : ''}`}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button type="button" className="btn btn-primary" style={{ fontSize: 12 }} disabled={busyId === r.id} onClick={() => onReview(r, 'approve')}>قبول</button>{' '}
                      <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} disabled={busyId === r.id} onClick={() => onReview(r, 'reject')}>رفض</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card ah-table-wrap" style={{ padding: 0 }}>
            <div className="card-title" style={{ padding: '14px 16px', margin: 0, borderBottom: '1px solid var(--line)' }}>آخر القرارات</div>
            <table className="table">
              <thead><tr><th>النوع</th><th>المعلّم</th><th>الحالة</th></tr></thead>
              <tbody>
                {decided.length === 0 && <EmptyRow colSpan={3}>—</EmptyRow>}
                {decided.map((r) => (
                  <tr key={r.id}>
                    <td>{r.kind === 'meeting' ? 'اجتماع' : 'تغطية'}</td>
                    <td>{r.teacherName}{r.studentName ? ` · ${r.studentName}` : ''}</td>
                    <td><span className="tag tag-outline">{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'exams' && (
        <div className="card ah-table-wrap" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>الاختبار</th><th>الصف</th><th>التاريخ</th><th>المعلّم</th><th></th></tr></thead>
            <tbody>
              {(exams || []).length === 0 && <EmptyRow colSpan={5}>لا اختبارات بانتظار الاعتماد.</EmptyRow>}
              {(exams || []).map((ex) => (
                <tr key={ex.id}>
                  <td>{ex.title}</td>
                  <td>{ex.className}</td>
                  <td className="ah-tabnum">{ex.examDate}</td>
                  <td>{ex.teacherName}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button type="button" className="btn btn-primary" style={{ fontSize: 12 }} disabled={busyId === ex.id} onClick={() => onExam(ex, true)}>اعتماد</button>{' '}
                    <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} disabled={busyId === ex.id} onClick={() => onExam(ex, false)}>رفض</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'alert' && (
        <form className="card" onSubmit={onAlert} style={{ gap: 10, maxWidth: 520 }}>
          <div className="card-title" style={{ margin: 0 }}>تنبيه إدارة لمعلّمين عن طالب</div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-neutral-600)' }}>
            من ملف الطالب انسخ teacherId من صفوفه، أو الصق معرّفات المعلّمين مفصولة بفاصلة. يصل الإشعار لصندوق المعلّم.
          </p>
          <div className="field">
            <label>اسم الطالب</label>
            <input className="input" value={alertStudentName} onChange={(e) => setAlertStudentName(e.target.value)} />
          </div>
          <div className="field">
            <label>معرّف الطالب (اختياري)</label>
            <input className="input" value={alertStudentId} onChange={(e) => setAlertStudentId(e.target.value)} dir="ltr" />
          </div>
          <div className="field">
            <label>معرّفات المعلّمين (UID)</label>
            <input className="input" value={alertTeacherIds} onChange={(e) => setAlertTeacherIds(e.target.value)} dir="ltr" placeholder="uid1, uid2" required />
          </div>
          <div className="field">
            <label>الرسالة</label>
            <textarea className="input" rows={3} value={alertMessage} onChange={(e) => setAlertMessage(e.target.value)} required />
          </div>
          {alertMsg && <div style={{ fontSize: 13, color: 'var(--color-accent-700)' }}>{alertMsg}</div>}
          <button type="submit" className="btn btn-primary" style={{ width: 'fit-content' }}>
            <Icon name="campaign" size={14} /> إرسال التنبيه
          </button>
        </form>
      )}
    </div>
  );
}
