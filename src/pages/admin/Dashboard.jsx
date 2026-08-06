import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { orderBy, limit as fbLimit } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { Kpi } from '../../components/ui';
import { demoDashboard } from '../../data/demo';
import { useAuth } from '../../context/AuthContext';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { adminPermissionForPath } from '../../layouts/AdminLayout';
import { iconForActivity } from '../../services/activity';
import { relativeFromTimestamp, relativeHoursAr } from '../../lib/relativeTime';

export default function Dashboard() {
  const navigate = useNavigate();
  const { can, isFirebaseConfigured } = useAuth();
  const d = demoDashboard; // KPIs/chart are a rollup view — need backend aggregation to go live, out of scope here
  const { data: activity, demo } = useLiveOrDemo('activityLog', [orderBy('createdAt', 'desc'), fbLimit(6)], d.activity);

  const canFinance = !isFirebaseConfigured || can('billing.manage');
  const canActivity = !isFirebaseConfigured || can('activity.view');

  const todos = useMemo(() => d.todo.filter((t) => {
    if (!isFirebaseConfigured) return true;
    const perm = adminPermissionForPath(t.to);
    return !perm || can(perm);
  }), [can, isFirebaseConfigured, d.todo]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="ah-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        {d.kpis.map((k) => <Kpi key={k.label} {...k} />)}
      </div>

      {canFinance && (
        <div className="ah-2col" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div className="card-title">الإيراد مقابل المصروف</div>
              <span className="tag tag-outline">آخر 8 أشهر</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 200, paddingTop: 10 }}>
              {d.chartBars.map((b) => (
                <div key={b.m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{ width: '100%', display: 'flex', gap: 3, alignItems: 'flex-end', height: '100%' }}>
                    <div style={{ flex: 1, background: 'var(--color-accent-200)', borderTop: '2px solid var(--gold)', height: `${b.rev}%` }} />
                    <div style={{ flex: 1, background: 'transparent', border: '1px solid var(--color-neutral-400)', borderBottom: 0, height: `${b.exp}%` }} />
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--color-neutral-500)' }}>{b.m}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 18, fontSize: 12, marginTop: 10, color: 'var(--color-neutral-600)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, background: 'var(--color-accent-200)', borderTop: '2px solid var(--gold)' }} />الإيراد</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, border: '1px solid var(--color-neutral-400)' }} />المصروف</span>
            </div>
          </div>
          <div className="card">
            <div className="card-title" style={{ marginBottom: 6 }}>حالة التحصيل</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 6 }}>
              {d.collect.map((c) => (
                <div key={c.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                    <span>{c.label}</span><span className="ah-tabnum" style={{ color: c.color }}>{c.amount}</span>
                  </div>
                  <div style={{ height: 7, background: 'var(--color-neutral-200)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${c.pct}%`, background: c.color }} />
                  </div>
                </div>
              ))}
            </div>
            <hr className="hr" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 13, color: 'var(--color-neutral-600)' }}>نسبة التحصيل</span>
              <span className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 28, color: 'var(--gold)' }}>{d.collectionRate}</span>
            </div>
          </div>
        </div>
      )}

      <div className="ah-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {canActivity && (
          <div className="card">
            <div className="card-title" style={{ marginBottom: 8 }}>النشاط الأخير</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {activity.length === 0 && <div style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>لا توجد حركات مسجّلة بعد.</div>}
              {activity.map((a, i) => (
                <div key={a.id || i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ width: 32, height: 32, flex: 'none', border: '1px solid var(--line)', borderRadius: '50%', display: 'grid', placeItems: 'center', color: 'var(--gold)' }}>
                    <Icon name={a.icon || iconForActivity(a.type)} size={15} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13 }}>{a.text || a.summary}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>
                      {demo ? relativeHoursAr(a.hoursAgo) : relativeFromTimestamp(a.createdAt)} · {a.who || a.actorName}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {!demo && (
              <button className="btn btn-ghost" style={{ fontSize: 12, marginTop: 8 }} onClick={() => navigate('/admin/activity')}>عرض سجلّ الحركات كاملاً ←</button>
            )}
          </div>
        )}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 8 }}>بانتظار إجرائك</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
            {todos.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>لا توجد مهام ضمن صلاحياتك حالياً.</div>
            )}
            {todos.map((t) => (
              <button key={t.label} onClick={() => navigate(t.to)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', background: 'transparent', cursor: 'pointer', textAlign: 'right', width: '100%' }}>
                <Icon name={t.icon} size={17} color="var(--gold)" />
                <span style={{ flex: 1, fontSize: 13 }}>{t.label}</span>
                <span className="tag tag-accent ah-tabnum">{t.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
