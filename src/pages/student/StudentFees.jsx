import { orderBy, where } from 'firebase/firestore';
import { ErrorBanner } from '../../components/ui';
import StudentFeeAidPanel from '../../components/StudentFeeAidPanel';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { useMyStudent } from '../../hooks/useMyStudent';
import { formatILS } from '../../lib/constants';
import { demoBilling, demoStudentDetail } from '../../data/demo';

export default function StudentFees() {
  const { student, studentId, error: stuErr, demo } = useMyStudent();
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
      <ErrorBanner>{(stuErr || cErr) && 'تعذّر تحميل المستحقات.'}</ErrorBanner>

      <header className="stu-page-head">
        <h1 className="stu-page-title">مستحقاتي</h1>
        <p className="stu-page-lead">للمتابعة فقط — الدفع من بوابة ولي الأمر</p>
      </header>

      <div className="stu-balance">
        <span className="stu-balance-lbl">المبلغ المستحق</span>
        <span className={`stu-balance-val ah-tabnum${balance > 0 ? '' : ' is-clear'}`}>
          {balance > 0 ? formatILS(balance) : 'لا شيء'}
        </span>
      </div>

      <section>
        <h2 className="stu-section-title">الفواتير</h2>
        {charges.length === 0 ? (
          <p className="stu-empty">ما في فواتير.</p>
        ) : (
          <div className="stu-list">
            {charges.map((c, i) => (
              <div key={c.id || i} className="stu-list-row">
                <div className="stu-list-main">
                  <div className="stu-list-title">{c.type || 'فاتورة'}</div>
                  <div className="stu-list-sub">{[c.status, c.method].filter(Boolean).join(' · ')}</div>
                </div>
                <span className="stu-list-side ah-tabnum">
                  {c.amount || formatILS(c.amountMinorUnits)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <StudentFeeAidPanel studentId={studentId || (demo ? 's1' : null)} demo={demo} framed />

      {(ledger || []).length > 0 && (
        <section>
          <h2 className="stu-section-title">آخر الحركات</h2>
          <div className="stu-list">
            {(ledger || []).slice(0, 12).map((l, i) => (
              <div key={l.id || i} className="stu-list-row">
                <div className="stu-list-main">
                  <div className="stu-list-title">{l.item}</div>
                  <div className="stu-list-sub ah-tabnum">{l.date || '—'}</div>
                </div>
                <span className="stu-list-side ah-tabnum">
                  {l.creditMinorUnits
                    ? `+${formatILS(l.creditMinorUnits)}`
                    : l.debitMinorUnits
                      ? formatILS(l.debitMinorUnits)
                      : '—'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
