import { Link } from 'react-router-dom';
import { orderBy, where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { ErrorBanner } from '../../components/ui';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { demoAdmissions, demoStudents } from '../../data/demo';

const LINKS = [
  { to: '/reception/admissions', icon: 'assignment', title: 'القبول والتسجيل', body: 'مراجعة طلبات الموقع وقبولها أو رفضها.' },
  { to: '/reception/students', icon: 'group', title: 'ملفات الطلاب', body: 'إنشاء طالب جديد أو فتح ملف موجود.' },
  { to: '/reception/enrollment', icon: 'person_add', title: 'تسجيل في الصفوف', body: 'إضافة الطالب المقبول إلى صف دراسي.' },
  { to: '/reception/absence-excuses', icon: 'event_available', title: 'تبريرات الغياب', body: 'مراجعة طلبات أولياء الأمور.' },
];

export default function ReceptionDashboard() {
  const { data: admissions, error: aErr } = useLiveOrDemo(
    'admissions',
    [orderBy('createdAt', 'desc')],
    demoAdmissions,
  );
  const { data: students, error: sErr } = useLiveOrDemo(
    'students',
    [where('status', '==', 'نشط')],
    demoStudents.filter((s) => s.status === 'نشط'),
  );
  const { data: excuses } = useLiveOrDemo(
    'absenceExcuses',
    [where('status', '==', 'قيد المراجعة')],
    [],
  );

  const pendingAdmissions = (admissions || []).filter((a) => a.status === 'review').length;
  const acceptedAdmissions = (admissions || []).filter((a) => a.status === 'accepted').length;
  const activeStudents = (students || []).length;
  const pendingExcuses = (excuses || []).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <ErrorBanner>{(aErr || sErr) && 'تعذّر تحميل بعض الإحصاءات.'}</ErrorBanner>
      <div className="card" style={{ borderColor: 'var(--color-accent-300)', background: 'var(--color-accent-100)', padding: '14px 16px', fontSize: 13, color: 'var(--color-accent-900)' }}>
        طلبات التسجيل، ملفات الطلاب، والتسجيل في الصفوف.
      </div>

      <div className="ah-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
        <div className="card">
          <span className="card-kicker">طلبات قيد المراجعة</span>
          <div className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 28, color: 'var(--gold)' }}>{pendingAdmissions}</div>
        </div>
        <div className="card">
          <span className="card-kicker">مقبولو التسجيل</span>
          <div className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 28 }}>{acceptedAdmissions}</div>
        </div>
        <div className="card">
          <span className="card-kicker">طلاب نشطون</span>
          <div className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 28 }}>{activeStudents}</div>
        </div>
        <div className="card">
          <span className="card-kicker">تبريرات بانتظارك</span>
          <div className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 28 }}>{pendingExcuses}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {LINKS.map((l) => (
          <Link key={l.to} to={l.to} className="card" style={{ textDecoration: 'none', color: 'inherit', gap: 10 }}>
            <Icon name={l.icon} size={22} color="var(--gold)" />
            <div className="card-title">{l.title}</div>
            <div className="card-body">{l.body}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
