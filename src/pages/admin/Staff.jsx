import { useMemo, useState } from 'react';
import { orderBy, where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { EmptyRow, ErrorBanner, Field } from '../../components/ui';
import Modal from '../../components/Modal';
import { useAuth } from '../../context/AuthContext';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { formatILS, SCHOOL_EMAIL_DOMAIN } from '../../lib/constants';
import { STAFF_ROLES } from '../../lib/permissions';
import {
  normalizeStaff, SALARY_TYPES, STAFF_ROLE_TYPES, currentPeriod, periodLabel, salaryTypeLabel, staffRoleLabel,
  isPortalStaffRole,
} from '../../lib/staff';
import { createStaffMember, deleteStaffMember, setStaffAttendance, updateStaffMember } from '../../services/staff';
import { createStaffAccount } from '../../services/users';
import { logActivity } from '../../services/activity';
import { demoStaffUsers } from '../../data/demo';

const demoStaff = [
  { id: 'st1', name: 'خالد الأحمد', roleType: 'teacher', jobTitleAr: 'معلّم لغة عربية', salaryType: 'monthly', monthlySalaryMinorUnits: 62000, baseMinorUnits: 62000, type: 'راتب شهري', active: true, authUid: 'u-teacher' },
  { id: 'st2', name: 'ليلى حسن', roleType: 'accountant', jobTitleAr: 'مسؤولة مالية', salaryType: 'monthly', monthlySalaryMinorUnits: 72000, baseMinorUnits: 72000, type: 'راتب شهري', active: true, authUid: 'u-accountant' },
  { id: 'st3', name: 'أبو سامي', roleType: 'cleaner', jobTitleAr: 'عامل نظافة', salaryType: 'daily', dailyRateMinorUnits: 8000, baseMinorUnits: 8000, type: 'راتب يومي', active: true },
  { id: 'st4', name: 'محمود الطاقة', roleType: 'utilities', jobTitleAr: 'فني طاقة / مولد', salaryType: 'hourly', hourlyRateMinorUnits: 2500, hoursPerMonth: 120, baseMinorUnits: 2500, type: 'أجر ساعة', active: true },
];

function StaffFormModal({ initial, demo, existingStaff, onClose }) {
  const { profile } = useAuth();
  const isEdit = !!initial?.id;
  const n = initial ? normalizeStaff(initial) : null;

  const { data: portalUsers } = useLiveOrDemo(
    'users',
    [where('role', 'in', STAFF_ROLES)],
    demoStaffUsers,
  );

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [entryMode, setEntryMode] = useState('existing'); // existing | new
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdCreds, setCreatedCreds] = useState(null);

  const needsPortal = !isEdit && isPortalStaffRole(roleType);
  const alreadyLinked = isEdit && !!n?.authUid;

  const linkedUids = useMemo(() => {
    const set = new Set();
    (existingStaff || []).forEach((s) => {
      if (s.authUid) set.add(s.authUid);
      if (s.id) set.add(s.id);
    });
    return set;
  }, [existingStaff]);

  const candidates = useMemo(() => {
    if (!needsPortal) return [];
    return portalUsers
      .filter((u) => u.role === roleType && !linkedUids.has(u.id))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ar'));
  }, [portalUsers, roleType, needsPortal, linkedUids]);

  const onRoleChange = (next) => {
    setRoleType(next);
    setSelectedUserId('');
    setEntryMode('existing');
    if (!isEdit && isPortalStaffRole(next)) {
      setName('');
      setJobTitleAr('');
    }
  };

  const onPickUser = (uid) => {
    setSelectedUserId(uid);
    const u = portalUsers.find((x) => x.id === uid);
    if (!u) return;
    setName(u.name || '');
    setJobTitleAr(u.title || staffRoleLabel(u.role) || '');
    setPhone(u.phone || u.contactPhone || '');
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (demo) { setError('صِل Firebase لحفظ الموظفين فعلياً.'); return; }
    setSubmitting(true);
    setError('');

    const payrollPayload = {
      name, roleType, jobTitleAr, salaryType,
      monthlySalaryShekels: monthly, hourlyRateShekels: hourly, dailyRateShekels: daily,
      hoursPerMonth: hours, phone, notes, active: true,
    };

    try {
      if (isEdit) {
        await updateStaffMember(initial.id, payrollPayload);
        onClose();
        return;
      }

      if (needsPortal && entryMode === 'existing') {
        if (!selectedUserId) {
          setError('اختَر موظفاً من القائمة، أو أنشئ حساباً جديداً.');
          setSubmitting(false);
          return;
        }
        const id = await createStaffMember({
          ...payrollPayload,
          authUid: selectedUserId,
        });
        await logActivity({
          type: 'staff_payroll_linked', actorUid: profile?.id, actorName: profile?.name, actorRole: profile?.role,
          summary: `ربط موظف بالرواتب: ${name} (${staffRoleLabel(roleType)})`,
          targetType: 'staff', targetId: id,
        }).catch(() => {});
        onClose();
        return;
      }

      if (needsPortal && entryMode === 'new') {
        if (!email.trim()) { setError('البريد الإلكتروني مطلوب لإنشاء حساب الدخول.'); setSubmitting(false); return; }
        if (password.trim().length < 6) { setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل.'); setSubmitting(false); return; }
        const res = await createStaffAccount({
          name,
          email: email.trim(),
          role: roleType,
          title: jobTitleAr.trim() || undefined,
          password: password.trim(),
          salaryType,
          monthlySalaryShekels: monthly,
          hourlyRateShekels: hourly,
          dailyRateShekels: daily,
          hoursPerMonth: hours,
          phone,
          notes,
        });
        setCreatedCreds({
          email: res.data?.email || email.trim(),
          tempPassword: res.data?.tempPassword || password.trim(),
          name,
          roleLabel: staffRoleLabel(roleType),
        });
        return;
      }

      const id = await createStaffMember(payrollPayload);
      await logActivity({
        type: 'staff_payroll_created', actorUid: profile?.id, actorName: profile?.name, actorRole: profile?.role,
        summary: `إضافة موظف للرواتب: ${name} (${staffRoleLabel(roleType)})`,
        targetType: 'staff', targetId: id,
      }).catch(() => {});
      onClose();
    } catch (err) {
      const msg = err?.message || '';
      if (msg.includes('مستخدم مسبقاً') || err?.code === 'functions/already-exists') {
        setError('هذا البريد مستخدم مسبقاً. جرّب بريداً آخر.');
      } else if (msg.includes('كلمة المرور') || msg.includes('صلاحية') || msg.includes('permission')) {
        setError('تعذّر الحفظ — تأكّد من صلاحياتك.');
      } else {
        setError('تعذّر الحفظ. تأكّد من صلاحياتك وأن البيانات صحيحة.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (createdCreds) {
    return (
      <Modal title="تم إنشاء الحساب والربط بالرواتب" onClose={onClose} onSubmit={(e) => { e.preventDefault(); onClose(); }} submitLabel="تم" width={480}>
        <div className="dialog-body">
          أُضيف {createdCreds.name} كـ{createdCreds.roleLabel} في النظام والرواتب معاً. شارك بيانات الدخول بطريقة آمنة.
        </div>
        <div className="card" style={{ gap: 8, padding: 14 }}>
          <div style={{ fontSize: 13 }}>البريد: <strong dir="ltr">{createdCreds.email}</strong></div>
          <div style={{ fontSize: 13 }}>كلمة المرور: <strong dir="ltr" className="ah-tabnum">{createdCreds.tempPassword}</strong></div>
        </div>
      </Modal>
    );
  }

  const submitLabel = needsPortal
    ? (entryMode === 'existing' ? 'إضافة للرواتب' : 'إنشاء الحساب وحفظ الراتب')
    : 'حفظ';

  return (
    <Modal
      title={isEdit ? 'تعديل موظف' : 'إضافة موظف / عامل'}
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel={submitLabel}
      submitting={submitting}
      error={error}
      width={520}
    >
      <div className="dialog-body">
        {needsPortal
          ? 'اختَر من حسابات النظام الموجودة (معلّم، محاسب، استقبال، مديرة)، أو أنشئ حساباً جديداً إن لزم.'
          : 'نظافة، طاقة، حراسة… حدّد نوع الراتب (شهري / ساعة / يومي).'}
      </div>

      <Field label="نوع الوظيفة">
        <select
          className="input"
          value={roleType}
          onChange={(e) => onRoleChange(e.target.value)}
          disabled={isEdit && alreadyLinked}
        >
          {STAFF_ROLE_TYPES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
      </Field>

      {needsPortal && (
        <div style={{ display: 'grid', gap: 12, padding: '12px 14px', borderRadius: 10, background: 'var(--color-accent-100)', border: '1px solid var(--color-accent-300)' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`btn ${entryMode === 'existing' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: 12 }}
              onClick={() => setEntryMode('existing')}
            >
              من حسابات النظام
            </button>
            <button
              type="button"
              className={`btn ${entryMode === 'new' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: 12 }}
              onClick={() => { setEntryMode('new'); setSelectedUserId(''); }}
            >
              إنشاء حساب جديد
            </button>
          </div>

          {entryMode === 'existing' && (
            <>
              <Field label={`اختيار ${staffRoleLabel(roleType)}`}>
                <select
                  className="input"
                  value={selectedUserId}
                  onChange={(e) => onPickUser(e.target.value)}
                  required
                >
                  <option value="">— اختَر من القائمة —</option>
                  {candidates.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}{u.email ? ` · ${u.email}` : ''}{u.title ? ` · ${u.title}` : ''}
                    </option>
                  ))}
                </select>
              </Field>
              {candidates.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>
                  لا يوجد {staffRoleLabel(roleType)} في النظام غير مضاف للرواتب. أنشئ حساباً جديداً أو أضِف المستخدم من شاشة المستخدمين أولاً.
                </div>
              )}
            </>
          )}

          {entryMode === 'new' && (
            <>
              <Field label="الاسم"><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
              <Field label="المسمّى الوظيفي"><input className="input" value={jobTitleAr} onChange={(e) => setJobTitleAr(e.target.value)} placeholder="مثال: معلّمة لغة عربية" /></Field>
              <Field label="البريد الإلكتروني">
                <input
                  className="input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={`name@${SCHOOL_EMAIL_DOMAIN}`}
                  dir="ltr"
                  style={{ textAlign: 'right' }}
                  required
                />
              </Field>
              <Field label="كلمة المرور">
                <input
                  className="input"
                  type="text"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="6 أحرف على الأقل"
                  dir="ltr"
                  style={{ textAlign: 'right' }}
                  required
                  minLength={6}
                />
              </Field>
            </>
          )}
        </div>
      )}

      {!needsPortal && !isEdit && (
        <>
          <Field label="الاسم"><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
          <Field label="المسمّى الوظيفي"><input className="input" value={jobTitleAr} onChange={(e) => setJobTitleAr(e.target.value)} placeholder="مثال: فني مولد" /></Field>
        </>
      )}

      {needsPortal && entryMode === 'existing' && selectedUserId && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="الاسم"><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
          <Field label="المسمّى الوظيفي"><input className="input" value={jobTitleAr} onChange={(e) => setJobTitleAr(e.target.value)} /></Field>
        </div>
      )}

      {isEdit && (
        <>
          <Field label="الاسم"><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
          <Field label="المسمّى الوظيفي"><input className="input" value={jobTitleAr} onChange={(e) => setJobTitleAr(e.target.value)} /></Field>
          {alreadyLinked && (
            <div style={{ fontSize: 12, color: 'var(--color-neutral-600)', padding: '4px 0' }}>
              مرتبط بحساب دخول في النظام · لا يمكن تغيير نوع الوظيفة من هنا.
            </div>
          )}
        </>
      )}

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
        عند اختيار معلّم أو محاسب أو استقبال أو مديرة تظهر حساباتهم الموجودة في النظام لتختار منها. الوظائف الأخرى تُسجَّل للرواتب فقط.
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
              <th>الدخول</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={6}>لا موظفون بعد.</EmptyRow>}
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
                <td>
                  {s.authUid
                    ? <span className="tag tag-accent" style={{ fontSize: 11 }}>حساب نظام</span>
                    : <span className="tag tag-neutral" style={{ fontSize: 11 }}>رواتب فقط</span>}
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
          existingStaff={data}
          onClose={() => { setShowForm(false); setEditRow(null); }}
        />
      )}
      {attRow && <AttendanceModal staff={attRow} period={period} demo={demo} onClose={() => setAttRow(null)} />}
    </div>
  );
}
