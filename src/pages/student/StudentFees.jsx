import { orderBy, where } from 'firebase/firestore';
import { EmptyRow, ErrorBanner } from '../../components/ui';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { useMyStudent } from '../../hooks/useMyStudent';
import { formatILS } from '../../lib/constants';
import { demoBilling, demoStudentDetail } from '../../data/demo';

export default function StudentFees() {
  const { student, studentId, displayName, error: stuErr, demo } = useMyStudent();
  const balance = Number(student?.balanceMinorUnits ?? student?.dueMinorUnits ?? 0);

  const { data: chargesRaw, error: cErr } = useLiveOrDemo(
    'charges',
    [where('studentId', '==', studentId || '__none__')],
    (demoBilling?.charges || []).filter((c) => c.student === 'يوسف الأحمد' || c.studentId === 's1'),
    studentId || '__none__',
  );
  const charges = [...(chargesRaw || [])].sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() || 0;
    const tb = b.createdAt?.toMillis?.() || 0;
    return tb - ta;
  });

  const { data: ledger } = useLiveOrDemo(
    `students/${studentId || '__none__'}/ledger`,
    [orderBy('date', 'desc')],
    demoStudentDetail.s1?.ledger || [],
    studentId || '__none__',
  );

  return (
    <div className="stu-page">
      <ErrorBanner>{(stuErr || cErr) && 'تعذّر تحميل البيانات المالية.'}</ErrorBanner>
      <header className="stu-page-head">
        <h1 className="stu-page-title">مستحقاتي</h1>
        <p className="stu-page-lead">
          عرض للشفافية فقط — السداد يتم عبر ولي الأمر من بوابته. {displayName}
        </p>
      </header>

      <div className="card" style={{ borderColor: 'color-mix(in srgb, var(--gold) 40%, var(--line))' }}>
        <span className="card-kicker">الرصيد المستحق حالياً</span>
        <div className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 32, color: balance > 0 ? 'var(--gold)' : 'var(--color-accent-700)' }}>
          {balance > 0 ? formatILS(balance) : 'لا مستحقات'}
        </div>
      </div>

      <section className="card ah-table-wrap" style={{ padding: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
          <h2 className="card-title" style={{ margin: 0 }}>الفواتير</h2>
        </div>
        <table className="table">
          <thead>
            <tr><th>النوع</th><th>المبلغ</th><th>الحالة</th><th>الطريقة</th></tr>
          </thead>
          <tbody>
            {(charges || []).length === 0 && <EmptyRow colSpan={4}>لا فواتير مسجّلة.</EmptyRow>}
            {(charges || []).map((c, i) => (
              <tr key={c.id || i}>
                <td>{c.type || '—'}</td>
                <td className="ah-tabnum">{c.amount || formatILS(c.amountMinorUnits)}</td>
                <td><span className="tag tag-outline">{c.status || '—'}</span></td>
                <td>{c.method || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card ah-table-wrap" style={{ padding: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
          <h2 className="card-title" style={{ margin: 0 }}>كشف الحساب</h2>
        </div>
        <table className="table">
          <thead>
            <tr><th>التاريخ</th><th>البند</th><th>مدين</th><th>دائن</th></tr>
          </thead>
          <tbody>
            {(ledger || []).length === 0 && <EmptyRow colSpan={4}>لا حركات في الدفتر.</EmptyRow>}
            {(ledger || []).map((l, i) => (
              <tr key={l.id || i}>
                <td className="ah-tabnum">{l.date || '—'}</td>
                <td>{l.item}</td>
                <td className="ah-tabnum">{l.debitMinorUnits ? formatILS(l.debitMinorUnits) : '—'}</td>
                <td className="ah-tabnum" style={{ color: 'var(--color-accent-700)' }}>
                  {l.creditMinorUnits ? formatILS(l.creditMinorUnits) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {demo && <p className="stu-class-meta">وضع العرض التوضيحي.</p>}
    </div>
  );
}
