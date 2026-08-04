import { orderBy, limit as fbLimit } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { ErrorBanner, EmptyRow } from '../../components/ui';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { demoActivityLog } from '../../data/demo';
import { iconForActivity } from '../../services/activity';
import { ROLE_LABELS } from '../../lib/permissions';
import { relativeFromTimestamp, relativeHoursAr } from '../../lib/relativeTime';

export default function ActivityLog() {
  const { data, error, demo } = useLiveOrDemo('activityLog', [orderBy('createdAt', 'desc'), fbLimit(100)], demoActivityLog);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ErrorBanner>{error && 'تعذّر تحميل سجلّ الحركات.'}</ErrorBanner>
      <div className="card-kicker">سجلّ يوثّق كل إجراء مهمّ عبر كل الأدوار — بالفاعل والوقت</div>
      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead><tr><th>الإجراء</th><th>الفاعل</th><th>الدور</th><th>الوقت</th></tr></thead>
          <tbody>
            {data.length === 0 && <EmptyRow colSpan={4}>لا توجد حركات مسجّلة بعد.</EmptyRow>}
            {data.map((a, i) => (
              <tr key={a.id || i}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name={iconForActivity(a.type)} size={16} color="var(--gold)" />
                    {a.summary}
                  </div>
                </td>
                <td>{a.actorName}</td>
                <td><span className="tag tag-outline">{ROLE_LABELS[a.actorRole] || a.actorRole}</span></td>
                <td className="ah-tabnum" style={{ color: 'var(--color-neutral-500)' }}>
                  {demo ? relativeHoursAr(a.hoursAgo) : relativeFromTimestamp(a.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
