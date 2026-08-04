import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { orderBy } from 'firebase/firestore';
import Icon from '../../components/Icon';
import BackButton from '../../components/BackButton';
import { ErrorBanner, EmptyRow } from '../../components/ui';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { demoExpenseCategories, demoExpenses } from '../../data/demo';
import NewExpenseModal from '../../modals/NewExpenseModal';
import { formatILS } from '../../lib/constants';
import { staffPortalBase } from '../../lib/portalPaths';

export default function Expenses() {
  const { pathname } = useLocation();
  const { data, error, demo } = useLiveOrDemo('expenses', [orderBy('createdAt', 'desc')], demoExpenses);
  const [showModal, setShowModal] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <BackButton to={staffPortalBase(pathname)} label="رجوع" />
      <ErrorBanner>{error && 'تعذّر تحميل دفتر المصاريف.'}</ErrorBanner>
      <div className="ah-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
        <div className="card">
          <div className="card-title" style={{ marginBottom: 8 }}>حسب الفئة</div>
          {demoExpenseCategories.map((e) => (
            <div key={e.name} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}><span>{e.name}</span><span className="ah-tabnum">{e.amount}</span></div>
              <div style={{ height: 6, background: 'var(--color-neutral-200)', borderRadius: 4, overflow: 'hidden' }}><div style={{ height: '100%', width: `${e.pct}%`, background: 'var(--gold)' }} /></div>
            </div>
          ))}
        </div>
        <div className="card ah-table-wrap" style={{ padding: 0 }}>
          <div style={{ padding: '14px 14px 0', display: 'flex', alignItems: 'center' }}>
            <div className="card-title">دفتر المصاريف</div>
            <button className="btn btn-primary" style={{ marginInlineStart: 'auto', fontSize: 13 }} onClick={() => setShowModal(true)}><Icon name="add" size={14} /> مصروف</button>
          </div>
          <table className="table" style={{ marginTop: 8 }}>
            <thead><tr><th>التاريخ</th><th>المورّد</th><th>الفئة</th><th>المبلغ</th><th>الحالة</th></tr></thead>
            <tbody>
              {data.length === 0 && <EmptyRow colSpan={5}>لا توجد مصاريف مسجّلة.</EmptyRow>}
              {data.map((x, i) => (
                <tr key={x.id || i}>
                  <td className="ah-tabnum" style={{ color: 'var(--color-neutral-500)' }}>{x.date}</td>
                  <td>{x.vendor}</td>
                  <td><span className="tag tag-neutral">{x.category}</span></td>
                  <td className="ah-tabnum">{x.amount || formatILS(x.amountMinorUnits)}</td>
                  <td><span className={`tag tag-${x.tone || 'outline'}`}>{x.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {showModal && <NewExpenseModal demo={demo} onClose={() => setShowModal(false)} />}
    </div>
  );
}
