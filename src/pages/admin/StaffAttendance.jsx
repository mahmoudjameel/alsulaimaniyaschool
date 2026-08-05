import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { where } from 'firebase/firestore';
import BackButton from '../../components/BackButton';
import SearchInput from '../../components/SearchInput';
import { EmptyRow, ErrorBanner } from '../../components/ui';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { useSchoolSite } from '../../hooks/useSchoolSite';
import { currentPeriod } from '../../lib/staff';
import { formatPunchTime, syncPayrollDaysFromPunches } from '../../services/staffPunch';
import { matchesTeacherSearch } from '../../lib/studentSearch';
import { ROLE_LABELS } from '../../lib/permissions';

const ROLE_FILTERS = [
  { id: 'الكل', label: 'الدور: الكل' },
  { id: 'teacher', label: 'معلّم' },
  { id: 'accountant', label: 'محاسب' },
  { id: 'reception', label: 'استقبال' },
];

const demoDays = [
  {
    id: 'demo1',
    teacherName: 'خالد الأحمد',
    teacherUid: 't-khaled',
    staffRole: 'teacher',
    date: '2026-08-05',
    period: '2026-08',
    status: 'مكتمل',
    checkInDistanceM: 42,
    checkOutDistanceM: 55,
    checkInAt: { seconds: Math.floor(Date.now() / 1000) - 3600 * 5 },
    checkOutAt: { seconds: Math.floor(Date.now() / 1000) - 600 },
  },
  {
    id: 'demo2',
    teacherName: 'ليلى حسن',
    teacherUid: 't-accountant',
    staffRole: 'accountant',
    date: '2026-08-05',
    period: '2026-08',
    status: 'حاضر',
    checkInDistanceM: 28,
    checkInAt: { seconds: Math.floor(Date.now() / 1000) - 3600 * 4 },
  },
  {
    id: 'demo3',
    teacherName: 'هدى مالك',
    teacherUid: 't-huda',
    staffRole: 'teacher',
    date: '2026-08-05',
    period: '2026-08',
    status: 'حاضر',
    checkInDistanceM: 18,
    checkInAt: { seconds: Math.floor(Date.now() / 1000) - 3600 * 3 },
  },
];

/**
 * Admin: track teacher check-in / check-out punches by day or month.
 */
export default function StaffAttendance() {
  const { site } = useSchoolSite();
  const [period, setPeriod] = useState(currentPeriod());
  const [dateFilter, setDateFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('الكل');
  const [search, setSearch] = useState('');
  const [syncing, setSyncing] = useState(null);
  const [syncMsg, setSyncMsg] = useState('');

  const { data, error, demo } = useLiveOrDemo(
    'staffAttendanceDays',
    // Equality-only query — no composite index required. Sort client-side.
    [where('period', '==', period)],
    demoDays.filter((d) => d.period === period || period === currentPeriod()),
    period,
  );

  const rows = useMemo(() => {
    let list = [...(data || [])];
    list.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    if (dateFilter) list = list.filter((r) => r.date === dateFilter);
    if (roleFilter !== 'الكل') list = list.filter((r) => (r.staffRole || 'teacher') === roleFilter);
    if (search.trim()) {
      list = list.filter((r) => matchesTeacherSearch(
        { name: r.teacherName, ...r },
        search,
      ));
    }
    return list;
  }, [data, dateFilter, roleFilter, search]);

  const stats = useMemo(() => {
    const present = rows.filter((r) => r.checkInAt).length;
    const complete = rows.filter((r) => r.checkOutAt).length;
    const names = new Set(rows.filter((r) => r.checkInAt).map((r) => r.teacherUid || r.teacherName));
    return { present, complete, teachers: names.size };
  }, [rows]);

  const onSync = async (row) => {
    if (demo || !row.teacherUid) {
      setSyncMsg(demo ? 'وضع العرض: الربط يعمل مع Firebase.' : 'لا يوجد معرّف معلّم.');
      return;
    }
    setSyncing(row.id);
    setSyncMsg('');
    try {
      const res = await syncPayrollDaysFromPunches(row.teacherUid, row.period || period);
      setSyncMsg(
        res?.staffUpdated
          ? `تم تحديث أيام الحضور (${res.daysPresent}) في سجل الموظف المرتبط.`
          : `حُسبت ${res?.daysPresent ?? 0} أيام — لا يوجد موظف مربوط بـ authUid لهذا المعلّم.`,
      );
    } catch {
      setSyncMsg('تعذّر المزامنة مع الرواتب.');
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <BackButton to="/admin" label="عودة للوحة القيادة" />
      <ErrorBanner>{error && 'تعذّر تحميل سجلات الحضور. تحقق من الاتصال أو صلاحياتك.'}</ErrorBanner>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="card-kicker">الشؤون الإدارية</div>
          <h2 style={{ margin: '4px 0 6px', fontSize: 24 }}>سجلّ حضور الموظفين</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-neutral-600)', lineHeight: 1.6 }}>
            حضور وانصراف الهيئة التدريسية والمالية والاستقبال ضمن النطاق المعتمد
            {site.locationLabelAr ? ` — ${site.locationLabelAr}` : ''}
            {' · '}{site.radiusMeters} م.
            {' '}
            <Link to="/admin/school-site" style={{ color: 'var(--gold)' }}>تعديل الموقع</Link>
          </p>
        </div>
      </div>

      <div className="ah-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        <div className="card"><span className="card-kicker">حضور مسجّل</span><div className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 26 }}>{stats.present}</div></div>
        <div className="card"><span className="card-kicker">أيام مكتملة</span><div className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 26 }}>{stats.complete}</div></div>
        <div className="card"><span className="card-kicker">موظفون</span><div className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 26 }}>{stats.teachers}</div></div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          الشهر
          <input className="input" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} style={{ width: 'auto' }} dir="ltr" />
        </label>
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          يوم محدد
          <input className="input" type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} style={{ width: 'auto' }} dir="ltr" />
        </label>
        {dateFilter && (
          <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setDateFilter('')}>مسح اليوم</button>
        )}
        <select
          className="input"
          style={{ width: 'auto', fontSize: 13 }}
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          {ROLE_FILTERS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="بحث باسم الموظف…"
          style={{ marginInlineStart: 'auto', maxWidth: 280 }}
        />
      </div>

      {syncMsg && <div style={{ fontSize: 13, color: 'var(--color-accent-800)' }}>{syncMsg}</div>}

      <div className="card ah-table-wrap" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>الموظف</th>
              <th>الدور</th>
              <th>اليوم</th>
              <th>حضور</th>
              <th>انصراف</th>
              <th>المسافة</th>
              <th>الحالة</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={8}>لا سجلات في هذه الفترة.</EmptyRow>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.teacherName || '—'}</td>
                <td style={{ fontSize: 12 }}>
                  {ROLE_LABELS[r.staffRole] || ROLE_LABELS.teacher}
                </td>
                <td className="ah-tabnum">{r.date}</td>
                <td className="ah-tabnum">{formatPunchTime(r.checkInAt)}</td>
                <td className="ah-tabnum">{formatPunchTime(r.checkOutAt)}</td>
                <td className="ah-tabnum" style={{ fontSize: 12 }}>
                  {r.checkInDistanceM != null ? `حضور ${r.checkInDistanceM}م` : '—'}
                  {r.checkOutDistanceM != null ? ` · انصراف ${r.checkOutDistanceM}م` : ''}
                </td>
                <td>
                  <span className={`tag tag-${r.checkOutAt ? 'accent' : r.checkInAt ? 'outline' : 'neutral'}`}>
                    {r.status || (r.checkOutAt ? 'مكتمل' : r.checkInAt ? 'حاضر' : '—')}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: 11 }}
                    disabled={syncing === r.id || !r.teacherUid}
                    onClick={() => onSync(r)}
                    title="مزامنة أيام الحضور مع سجل الموظف للرواتب"
                  >
                    {syncing === r.id ? '…' : 'للرواتب'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
