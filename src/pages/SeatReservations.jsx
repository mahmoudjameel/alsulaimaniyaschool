import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { orderBy } from 'firebase/firestore';
import Icon from '../components/Icon';
import BackButton from '../components/BackButton';
import SearchInput from '../components/SearchInput';
import { EmptyRow, ErrorBanner } from '../components/ui';
import { useLiveOrDemo } from '../hooks/useFirestore';
import { useAcademicStages } from '../hooks/useAcademicStages';
import { demoBilling, demoStudents } from '../data/demo';
import { formatILS } from '../lib/constants';
import { SEAT_RESERVATION_TYPE, isSeatReservationType } from '../lib/feeTypes';
import {
  formatChargeStageLabel,
  studentsByIdMap,
  chargeMatchesStage,
} from '../lib/chargeFilters';
import { filterByStudentSearch } from '../lib/studentSearch';
import { staffPortalBase } from '../lib/portalPaths';
import EditInvoiceModal from '../modals/EditInvoiceModal';
import NewInvoiceModal from '../modals/NewInvoiceModal';

const STATUS_TONE = { 'مؤكَّد': 'accent', 'قيد التأكيد': 'outline', 'مسودّة': 'neutral', 'متأخّر': 'accent2' };

/**
 * Dedicated seat-reservation registry: sequential count, stage fees,
 * separate from monthly tuition invoices.
 */
export default function SeatReservations() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const portal = staffPortalBase(pathname);
  const { data: charges, error, demo } = useLiveOrDemo('charges', [orderBy('createdAt', 'desc')], demoBilling.charges);
  const { data: students } = useLiveOrDemo('students', [orderBy('name', 'asc')], demoStudents);
  const { stages, labels: stageLabels } = useAcademicStages();
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('الكل');
  const [editing, setEditing] = useState(null);
  const [showNew, setShowNew] = useState(false);

  const studentMap = useMemo(() => studentsByIdMap(students), [students]);

  const seatCharges = useMemo(() => {
    const list = (charges || []).filter((c) => isSeatReservationType(c.type));
    const filtered = list.filter((c) => {
      if (!chargeMatchesStage(c, stageFilter, studentMap)) return false;
      if (!search.trim()) return true;
      const student = studentMap.get(c.studentId);
      return filterByStudentSearch(
        [{
          id: c.id,
          name: c.student || c.studentName || student?.name,
          displayId: student?.displayId,
          nationalId: student?.nationalId,
          grade: c.grade || student?.grade,
        }],
        search,
      ).length > 0;
    });
    return [...filtered].sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
      const tb = b.createdAt?.toMillis?.() || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
      return ta - tb;
    });
  }, [charges, stageFilter, studentMap, search]);

  const byStage = useMemo(() => {
    const map = new Map();
    for (const s of stages) {
      map.set(s.labelAr, {
        label: s.labelAr,
        seatFee: Number(s.seatReservationMinorUnits) || 0,
        monthlyFee: Number(s.monthlyTuitionMinorUnits) || 0,
        count: 0,
        total: 0,
      });
    }
    for (const c of seatCharges) {
      const label = c.stageLabel || String(c.grade || '').split('/')[0].trim() || '—';
      if (!map.has(label)) {
        map.set(label, { label, seatFee: 0, monthlyFee: 0, count: 0, total: 0 });
      }
      const row = map.get(label);
      row.count += 1;
      row.total += Number(c.amountMinorUnits) || 0;
    }
    return [...map.values()].filter((r) => r.count > 0 || r.seatFee > 0);
  }, [stages, seatCharges]);

  const confirmed = seatCharges.filter((c) => c.status === 'مؤكَّد').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <BackButton
        to={portal === '/accountant' ? '/accountant/invoices' : '/admin/billing'}
        label="عودة للفواتير"
      />
      <ErrorBanner>{error && 'تعذّر تحميل حجوزات المقاعد.'}</ErrorBanner>

      <header style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0 }}>سجل حجز المقعد</h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--color-neutral-600)', lineHeight: 1.6 }}>
            حجز المقعد رسم لمرة واحدة حسب المرحلة — منفصل تماماً عن الرسوم الدراسية الشهرية (١٠ أقساط).
          </p>
        </div>
        <button type="button" className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => setShowNew(true)} disabled={demo}>
          <Icon name="event" size={15} /> تسجيل حجز مقعد
        </button>
      </header>

      <div className="ah-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        <div className="card">
          <span className="card-kicker">عدد حجوزات المقعد</span>
          <div className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 28, color: 'var(--gold)' }}>{seatCharges.length}</div>
        </div>
        <div className="card">
          <span className="card-kicker">مؤكَّد</span>
          <div className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 28 }}>{confirmed}</div>
        </div>
        <div className="card">
          <span className="card-kicker">إجمالي مبالغ الحجز</span>
          <div className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 22, color: 'var(--gold)' }}>
            {formatILS(seatCharges.reduce((a, c) => a + Number(c.amountMinorUnits || 0), 0))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title" style={{ marginBottom: 8 }}>مبلغ حجز المقعد حسب المرحلة (≠ الرسوم الشهرية)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
          {byStage.map((s) => (
            <div key={s.label} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{s.label}</div>
              <div style={{ fontSize: 12, color: 'var(--color-neutral-600)', marginTop: 6 }}>
                حجز مقعد: <strong className="ah-tabnum">{s.seatFee ? formatILS(s.seatFee) : '—'}</strong>
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>
                شهري (مرجع): {s.monthlyFee ? formatILS(s.monthlyFee) : '—'}
              </div>
              <div style={{ fontSize: 12, marginTop: 6 }}>محجوز: <strong>{s.count}</strong></div>
            </div>
          ))}
          {byStage.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>
              لا بيانات بعد. حدّد مبالغ حجز المقعد من{' '}
              <Link to="/admin/stages" style={{ color: 'var(--gold)' }}>المراحل الدراسية</Link>.
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchInput value={search} onChange={setSearch} placeholder="بحث باسم الطالب…" style={{ maxWidth: 280 }} />
        <select className="input" style={{ width: 'auto', fontSize: 13 }} value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
          <option value="الكل">المرحلة: الكل</option>
          {stageLabels.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <span className="tag tag-accent" style={{ fontSize: 12 }}>العدّاد: {seatCharges.length} حجز</span>
      </div>

      <div className="card ah-table-wrap" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>الطالب</th>
              <th>المرحلة</th>
              <th>نوع الرسم</th>
              <th>المبلغ</th>
              <th>الحالة</th>
              <th>طريقة الدفع</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {seatCharges.length === 0 && (
              <EmptyRow colSpan={8}>لا حجوزات مقعد بعد. سجّل طالباً جديداً أو اضغط «تسجيل حجز مقعد».</EmptyRow>
            )}
            {seatCharges.map((c, i) => (
              <tr key={c.id || i}>
                <td className="ah-tabnum" style={{ fontWeight: 700, color: 'var(--gold)' }}>{i + 1}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: 13, padding: 0 }}
                    onClick={() => c.studentId && navigate(`${portal}/students/${c.studentId}`)}
                  >
                    {c.student}
                  </button>
                </td>
                <td style={{ fontSize: 13 }}>{formatChargeStageLabel(c, studentMap)}</td>
                <td><span className="tag tag-accent">{SEAT_RESERVATION_TYPE}</span></td>
                <td className="ah-tabnum">{formatILS(c.amountMinorUnits)}</td>
                <td><span className={`tag tag-${STATUS_TONE[c.status] || 'neutral'}`}>{c.status}</span></td>
                <td>{c.method || '—'}</td>
                <td style={{ textAlign: 'left' }}>
                  <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setEditing(c)} disabled={demo}>
                    تعديل
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && <EditInvoiceModal charge={editing} demo={demo} onClose={() => setEditing(null)} stages={stages} />}
      {showNew && (
        <NewInvoiceModal
          students={students}
          demo={demo}
          stages={stages}
          defaultType={SEAT_RESERVATION_TYPE}
          onClose={() => setShowNew(false)}
          onSaved={() => {
            setShowNew(false);
          }}
        />
      )}
    </div>
  );
}
