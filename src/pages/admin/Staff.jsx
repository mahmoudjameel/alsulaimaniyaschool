import { useMemo, useState } from 'react';
import { orderBy } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { EmptyRow, ErrorBanner, Field } from '../../components/ui';
import Modal from '../../components/Modal';
import { useAuth } from '../../context/AuthContext';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { formatILS } from '../../lib/constants';
import {
  normalizeStaff, SALARY_TYPES, STAFF_ROLE_TYPES, currentPeriod, periodLabel, salaryTypeLabel, staffRoleLabel,
} from '../../lib/staff';
import { createStaffMember, deleteStaffMember, setStaffAttendance, updateStaffMember } from '../../services/staff';
import { logActivity } from '../../services/activity';

const demoStaff = [
  { id: 'st1', name: 'خالد الأحمد', roleType: 'teacher', jobTitleAr: 'معلّم لغة عربية', salaryType: 'monthly', monthlySalaryMinorUnits: 62000, baseMinorUnits: 62000, type: 'راتب شهري', active: true },
  { id: 'st2', name: 'ليلى حسن', roleType: 'accountant', jobTitleAr: 'مسؤولة مالية', salaryType: 'monthly', monthlySalaryMinorUnits: 72000, baseMinorUnits: 72000, type: 'راتب شهري', active: true },
  { id: 'st3', name: 'أبو سامي', roleType: 'cleaner', jobTitleAr: 'عامل نظافة', salaryType: 'daily', dailyRateMinorUnits: 8000, baseMinorUnits: 8000, type: 'راتب يومي', active: true },
  { id: 'st4', name: 'محمود الطاقة', roleType: 'utilities', jobTitleAr: 'فني طاقة / مولد', salaryType: 'hourly', hourlyRateMinorUnits: 2500, hoursPerMonth: 120, baseMinorUnits: 2500, type: 'أجر ساعة', active: true },
];

function StaffFormModal({ initial, demo, onClose, onSaved }) {
  const { profile } = useAuth();
  const n = initial ? normalizeStaff(initial) : null;
  const [name, setName] = useState(n?.name || '');
  const [roleType, setRoleType] = useState(n?.roleType || 'teacher');
  const [jobTitleAr, setJobTitleAr] = useState(n?.jobTitleAr || '');
  const [salaryType, setSalaryType] = useState(n?.salaryType || 'monthly');
  const [monthly, setMonthly] = useState(n?.monthlySalaryMinorUnits != null ? String(n.monthlySalaryMinorUnits / 100) : '');
  const [hourly, setHourly] = useState(n?.hourlyRateMinorUnits != null ? String(n.hourlyRateMinorUnits / 100) : '');
  const [daily, setDaily] = useState(n?.dailyRateMinorUnits != null ? String(n.dailyRateMinorUnits / 100) : '');
  const [hours, setHours] = useState(n?.hoursPerMonth != null ? String(n.hoursPerMonth) : '160');
  const [phone, setPhone] = useState(n?.phone || '');
  const [notes, setNotes] = useState(n?.notes || '');
  const [authUid, setAuthUid] = useState(n?.authUid || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    if (demo) { setError('صِل Firebase لحفظ الموظفين فعلياً.'); return; }
    setSubmitting(true);
    setError('');
    const payload = {
      name, roleType, jobTitleAr, salaryType,
      monthlySalaryShekels: monthly, hourlyRateShekels: hourly, dailyRateShekels: daily,
      hoursPerMonth: hours, phone, notes, active: true,
      authUid: authUid.trim() || null,
    };
    try {
      if (initial?.id) {
        await updateStaffMember(initial.id, payload);
      } else {
        const id = await createStaffMember(payload);
        await logActivity({
          type: 'staff_payroll_created', actorUid: profile?.id, actorName: profile?.name, actorRole: profile?.role,
          summary: `إضافة موظف للرواتب: ${name} (${staffRoleLabel(roleType)})`,
          targetType: 'staff', targetId: id,
        }).catch(() => {});
      }
      onSaved?.();
      onClose();
    } catch {
      setError('تعذّر الحفظ.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={initial ? 'تعديل موظف' : 'إضافة موظف / عامل'} onClose={onClose} onSubmit={onSubmit} submitLabel="حفظ" submitting={submitting} error={error} width={520}>
      <div className="dialog-body">معلّمون، محاسبون، نظافة، طاقة، حراسة… حدّد نوع الراتب (شهري / ساعة / يومي) وعدد الساعات المتوقعة.</div>
      <Field label="الاسم"><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="نوع الوظيفة">
          <select className="input" value={roleType} onChange={(e) => setRoleType(e.target.value)}>
            {STAFF_ROLE_TYPES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </Field>
        <Field label="المسمّى الوظيفي"><input className="input" value={jobTitleAr} onChange={(e) => setJobTitleAr(e.target.value)} placeholder="مثال: فني مولد" /></Field>
      </div>
      <Field label="نظام الأجر">
        <select className="input" value={salaryType} onChange={(e) => setSalaryType(e.target.value)}>
          {SALARY_TYPES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </Field>
      {salaryType === 'monthly' && (
        <Field label="الراتب الشهري (₪)">
          <input className="input" type="number" min="0" value={monthly} onChange={(e) => setMonthly(e.target.value)} required dir="ltr" style={{ textAlign: 'right' }} />
        </Field>
      )}
      {salaryType === 'hourly' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="أجر الساعة (₪)">
            <input className="input" type="number" min="0" step="0.01" value={hourly} onChange={(e) => setHourly(e.target.value)} required dir="ltr" style={{ textAlign: 'right' }} />
          </Field>
          <Field label="ساعات متوقعة / شهر">
            <input className="input" type="number" min="1" value={hours} onChange={(e) => setHours(e.target.value)} dir="ltr" style={{ textAlign: 'right' }} />
          </Field>
        </div>
      )}
      {salaryType === 'daily' && (
        <Field label="الأجر اليومي (₪)">
          <input className="input" type="number" min="0" value={daily} onChange={(e) => setDaily(e.target.value)} required dir="ltr" style={{ textAlign: 'right' }} />
        </Field>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="الهاتف"><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" style={{ textAlign: 'right' }} /></Field>
        <Field label="ملاحظات"><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </div>
      <Field label="ربط حساب الدخول (UID) — لسجلّ الحضور والرواتب">
        <input
          className="input"
          value={authUid}
          onChange={(e) => setAuthUid(e.target.value)}
          dir="ltr"
          style={{ textAlign: 'right' }}
          placeholder="معرّف المستخدم من شاشة المستخدمين"
        />
      </Field>
    </Modal>
  );
}

function AttendanceModal({ staff, period, demo, onClose }) {
  const [daysPresent, setDaysPresent] = useState('22');
  const [workingDays, setWorkingDays] = useState('22');
  const [hoursWorked, setHoursWorked] = useState(staff.hoursPerMonth ? String(staff.hoursPerMonth) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const n = normalizeStaff(staff);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (demo) { setError('صِل Firebase.'); return; }
    setBusy(true);
    try {
      await setStaffAttendance(staff.id, period, { daysPresent, workingDays, hoursWorked: n.salaryType === 'hourly' ? hoursWorked : null });
      onClose();
    } catch {
      setError('تعذّر الحفظ.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`حضور / ساعات — ${staff.name}`} onClose={onClose} onSubmit={onSubmit} submitLabel="حفظ" submitting={busy} error={error} width={420}>
      <div className="dialog-body">الفترة: {periodLabel(period)}. يُستخدم عند احتساب الرواتب.</div>
      {n.salaryType === 'hourly' ? (
        <Field label="ساعات العمل الفعلية هذا الشهر">
          <input className="input" type="number" value={hoursWorked} onChange={(e) => setHoursWorked(e.target.value)} required dir="ltr" style={{ textAlign: 'right' }} />
        </Field>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="أيام الحضور"><input className="input" type="number" value={daysPresent} onChange={(e) => setDaysPresent(e.target.value)} dir="ltr" style={{ textAlign: 'right' }} /></Field>
          <Field label="أيام العمل"><input className="input" type="number" value={workingDays} onChange={(e) => setWorkingDays(e.target.value)} dir="ltr" style={{ textAlign: 'right' }} /></Field>
        </div>
      )}
    </Modal>
  );
}

export default function Staff() {
  const { data, demo, error } = useLiveOrDemo('staff', [orderBy('name', 'asc')], demoStaff);
  const [roleFilter, setRoleFilter] = useState('الكل');
  const [showForm, setShowForm] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [attRow, setAttRow] = useState(null);
  const period = currentPeriod();

  const rows = useMemo(() => data.map(normalizeStaff).filter((s) => (
    roleFilter === 'الكل' || s.roleType === roleFilter
  )), [data, roleFilter]);

  const onDelete = async (s) => {
    if (demo) return;
    if (!window.confirm(`حذف ${s.name} من سجل الرواتب؟`)) return;
    await deleteStaffMember(s.id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ErrorBanner>{error && 'تعذّر تحميل الموظفين.'}</ErrorBanner>
      <div className="card" style={{ borderColor: 'var(--color-accent-300)', background: 'var(--color-accent-100)', padding: '14px 16px', fontSize: 13, color: 'var(--color-accent-900)' }}>
        سجّل كل طاقم المدرسة هنا: معلّمون، محاسب، نظافة، طاقة، حراسة. الراتب يُحسب من لوحة الرواتب حسب الأيام أو الساعات التي تدخلها لكل فترة.
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="input" style={{ width: 'auto', fontSize: 13 }} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="الكل">كل الوظائف</option>
          {STAFF_ROLE_TYPES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <span className="tag tag-neutral">فترة الحضور: {periodLabel(period)}</span>
        <span style={{ marginInlineStart: 'auto' }} />
        <button type="button" className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => { setEditRow(null); setShowForm(true); }}>
          <Icon name="person_add" size={14} /> إضافة موظف
        </button>
      </div>
      <div className="card ah-table-wrap" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>الموظف</th>
              <th>الوظيفة</th>
              <th>نظام الأجر</th>
              <th>الأجر / الساعات</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={5}>لا موظفون بعد.</EmptyRow>}
            {rows.map((s) => (
              <tr key={s.id} style={{ opacity: s.active === false ? 0.5 : 1 }}>
                <td>
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  {s.phone && <div className="ah-tabnum" style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>{s.phone}</div>}
                </td>
                <td>
                  <div>{staffRoleLabel(s.roleType)}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>{s.jobTitleAr}</div>
                </td>
                <td>{salaryTypeLabel(s.salaryType, s.type)}</td>
                <td className="ah-tabnum">
                  {s.salaryType === 'hourly' && <>{formatILS(s.hourlyRateMinorUnits)} / ساعة · {s.hoursPerMonth || '—'} س</>}
                  {s.salaryType === 'daily' && <>{formatILS(s.dailyRateMinorUnits)} / يوم</>}
                  {s.salaryType === 'monthly' && formatILS(s.monthlySalaryMinorUnits || s.baseMinorUnits)}
                </td>
                <td style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>
                  <button type="button" className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => setAttRow(s)}>حضور/ساعات</button>
                  <button type="button" className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => { setEditRow(s); setShowForm(true); }}>تعديل</button>
                  <button type="button" className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => onDelete(s)}>حذف</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm && (
        <StaffFormModal
          initial={editRow}
          demo={demo}
          onClose={() => { setShowForm(false); setEditRow(null); }}
        />
      )}
      {attRow && <AttendanceModal staff={attRow} period={period} demo={demo} onClose={() => setAttRow(null)} />}
    </div>
  );
}
