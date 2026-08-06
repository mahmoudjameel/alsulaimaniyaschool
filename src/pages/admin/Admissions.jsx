import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { orderBy } from 'firebase/firestore';
import Icon from '../../components/Icon';
import SearchInput from '../../components/SearchInput';
import { SegmentedTabs, EmptyRow, ErrorBanner } from '../../components/ui';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { demoAdmissions } from '../../data/demo';
import { acceptAdmission, rejectAdmission } from '../../services/admissions';
import { relativeDaysAr, relativeFromTimestamp } from '../../lib/relativeTime';
import { staffPortalBase } from '../../lib/portalPaths';
import { matchesStudentSearch } from '../../lib/studentSearch';

const TABS = [
  { id: 'review', label: 'قيد المراجعة' },
  { id: 'accepted', label: 'مقبول' },
  { id: 'rejected', label: 'مرفوض' },
];

export default function Admissions() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const portalBase = staffPortalBase(pathname);
  const [filter, setFilter] = useState('review');
  const [search, setSearch] = useState('');
  const [demoOverrides, setDemoOverrides] = useState({});
  const [busyId, setBusyId] = useState(null);
  const { data, demo, error } = useLiveOrDemo('admissions', [orderBy('createdAt', 'desc')], demoAdmissions);

  const rows = useMemo(() => data.map((r) => (
    demo && demoOverrides[r.id] ? { ...r, status: demoOverrides[r.id] } : r
  )), [data, demo, demoOverrides]);

  const counts = useMemo(() => ({
    review: rows.filter((r) => r.status === 'review').length,
    accepted: rows.filter((r) => r.status === 'accepted').length,
    rejected: rows.filter((r) => r.status === 'rejected').length,
  }), [rows]);

  const view = useMemo(
    () => rows.filter((r) => r.status === filter && matchesStudentSearch(r, search)),
    [rows, filter, search],
  );
  const hasDuplicateWarning = filter === 'review' && view.some((r) => r.duplicateWarning);

  const onAccept = async (row) => {
    setBusyId(row.id);
    try {
      if (demo) setDemoOverrides((s) => ({ ...s, [row.id]: 'accepted' }));
      else await acceptAdmission(row.id);
    } finally {
      setBusyId(null);
    }
  };
  const onReject = async (row) => {
    setBusyId(row.id);
    try {
      if (demo) setDemoOverrides((s) => ({ ...s, [row.id]: 'rejected' }));
      else await rejectAdmission(row.id);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ErrorBanner>{error && 'تعذّر تحميل طلبات التسجيل. تحقق من اتصال الإنترنت أو صلاحياتك.'}</ErrorBanner>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <SegmentedTabs tabs={TABS.map((t) => ({ ...t, label: `${t.label} · ${counts[t.id]}`, active: filter === t.id, onClick: () => setFilter(t.id) }))} />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="بحث بالاسم أو رقم الهوية…"
          style={{ marginInlineStart: 'auto', maxWidth: 320 }}
        />
        <span className="tag tag-neutral">تسجيل موسمي: مخيّم صيفي</span>
      </div>
      <div className="card ah-table-wrap" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>مقدّم الطلب</th>
              <th>ولي الأمر</th>
              <th>السكن</th>
              <th>الهوية</th>
              <th>الصف</th>
              <th>الهاتف</th>
              <th>المصدر</th>
              <th>التاريخ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {view.length === 0 && <EmptyRow colSpan={9}>لا توجد طلبات في هذه الفئة حالياً.</EmptyRow>}
            {view.map((r) => (
              <tr key={r.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.duplicateWarning ? 'var(--color-accent-800)' : 'var(--gold)' }} />
                    <div>
                      <div>{r.name}</div>
                      {(r.birthDate || r.ageYears != null) && (
                        <div style={{ fontSize: 11, color: 'var(--color-neutral-500)', marginTop: 2 }}>
                          {r.birthDate ? r.birthDate : ''}{r.birthDate && r.ageYears != null ? ' · ' : ''}
                          {r.ageYears != null ? `${r.ageYears} سنة` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td>
                  <div>{r.guardian}</div>
                  {(r.guardianWorkStatus || r.housingType) && (
                    <div style={{ fontSize: 11, color: 'var(--color-neutral-500)', marginTop: 2 }}>
                      {[r.guardianWorkStatus, r.housingType].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </td>
                <td style={{ fontSize: 12, maxWidth: 160 }}>
                  {r.residentialAddress || '—'}
                </td>
                <td className="ah-tabnum">{r.nationalId || '—'}</td>
                <td>{r.grade}</td>
                <td className="ah-tabnum">{r.phone}</td>
                <td><span className="tag tag-neutral">{r.source}</span></td>
                <td className="ah-tabnum" style={{ color: 'var(--color-neutral-500)' }}>
                  {demo ? relativeDaysAr(r.daysAgo) : relativeFromTimestamp(r.createdAt)}
                </td>
                <td style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>
                  {r.status === 'review' ? (
                    <>
                      <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: 12 }} disabled={busyId === r.id} onClick={() => onAccept(r)}>قبول</button>{' '}
                      <button className="btn btn-ghost" style={{ fontSize: 12 }} disabled={busyId === r.id} onClick={() => onReject(r)}>رفض</button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ fontSize: 12 }}
                      disabled={!r.linkedStudentId}
                      onClick={() => {
                        if (r.linkedStudentId) navigate(`${portalBase}/students/${r.linkedStudentId}`);
                      }}
                    >
                      عرض الملف
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasDuplicateWarning && (
        <div className="card" style={{ borderStyle: 'dashed' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <Icon name="warning" size={18} color="var(--gold)" style={{ marginTop: 2 }} />
            <div>
              <div className="card-title" style={{ fontSize: 15 }}>تحذير ازدواجية</div>
              <div style={{ fontSize: 13, color: 'var(--color-neutral-600)' }}>رقم هاتف أحد مقدّمي الطلبات يطابق ولي أمر مسجّل مسبقاً. المراجعة مطلوبة قبل القبول.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
