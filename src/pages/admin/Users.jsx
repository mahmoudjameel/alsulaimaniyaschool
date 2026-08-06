import { useMemo, useState } from 'react';
import { where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import { ErrorBanner } from '../../components/ui';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { demoStaffUsers } from '../../data/demo';
import {
  ROLE_LABELS, STAFF_ROLES, permissionsForUser, PERMISSIONS, ROLE_DEFAULT_PERMISSIONS,
} from '../../lib/permissions';
import NewStaffModal from '../../modals/NewStaffModal';
import EditPermissionsModal from '../../modals/EditPermissionsModal';

export default function Users() {
  // Avoid orderBy + where('in') composite-index requirement: filter by role,
  // then sort names client-side so the page works even before indexes deploy.
  const { data: raw, error, demo } = useLiveOrDemo(
    'users',
    [where('role', 'in', STAFF_ROLES)],
    demoStaffUsers
  );
  const data = useMemo(
    () => [...raw].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ar')),
    [raw]
  );
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState(null);

  const errorHint = (() => {
    if (!error) return null;
    const code = error.code || '';
    if (code.includes('permission-denied')) {
      return 'تعذّر تحميل المستخدمين: لا تملك صلاحية القراءة. سجّل الدخول بحساب إدارة.';
    }
    if (code.includes('failed-precondition')) {
      return 'تعذّر تحميل المستخدمين: فهرس Firestore ناقص — جارٍ الإصلاح تلقائياً بعد النشر.';
    }
    return 'تعذّر تحميل المستخدمين.';
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ErrorBanner>{errorHint}</ErrorBanner>

      <div className="card" style={{ gap: 8, background: 'var(--color-accent-100)', borderColor: 'color-mix(in srgb, var(--gold) 35%, transparent)' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 17, fontWeight: 700 }}>الصلاحيات المخصّصة</div>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.75, color: 'var(--color-neutral-700)' }}>
          كل دور له صلاحيات افتراضية وشاشات ظاهرة في القائمة.
          دور <strong>المديرة</strong> يدخل لوحة الإدارة بصلاحيات طلاب/أكاديمي افتراضياً (بدون مالية كاملة وبدون مستخدمين أو نسخ احتياطي).
          من «تعديل الصلاحيات» فعّلي أو ألغِ أي شاشة لكل شخص.
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h4 style={{ margin: 0 }}>المستخدمون</h4>
        <span style={{ marginInlineStart: 'auto' }} />
        <button type="button" className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => setShowNew(true)}>
          <Icon name="person_add" size={15} /> دعوة مستخدم جديد
        </button>
      </div>

      <div className="card ah-table-wrap" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>الاسم</th>
              <th>الدور</th>
              <th>المسمّى</th>
              <th>الصلاحيات</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {!error && data.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-neutral-500)', padding: 28 }}>
                  لا يوجد مستخدمون بعد — ادعُ مديرة أو معلّماً أو محاسباً من الزر أعلاه.
                </td>
              </tr>
            )}
            {data.map((u, i) => {
              const perms = permissionsForUser(u);
              const defaults = ROLE_DEFAULT_PERMISSIONS[u.role] || {};
              const granted = PERMISSIONS.filter((p) => perms[p.key]);
              const extras = granted.filter((p) => !defaults[p.key]);
              const revoked = PERMISSIONS.filter((p) => defaults[p.key] && !perms[p.key]);

              return (
                <tr key={u.id || i}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-neutral-500)' }} dir="ltr">{u.email || '—'}</div>
                  </td>
                  <td><span className="tag tag-outline">{ROLE_LABELS[u.role] || u.role}</span></td>
                  <td>{u.title || '—'}</td>
                  <td style={{ maxWidth: 360 }}>
                    {u.role === 'admin' ? (
                      <span className="tag tag-accent">كل الصلاحيات</span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {granted.length === 0 && (
                            <span style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>لا صلاحيات ممنوحة</span>
                          )}
                          {granted.slice(0, 6).map((p) => (
                            <span key={p.key} className={`tag ${defaults[p.key] ? 'tag-neutral' : 'tag-accent'}`} style={{ fontSize: 10 }}>
                              {p.label}
                            </span>
                          ))}
                          {granted.length > 6 && (
                            <span className="tag tag-neutral" style={{ fontSize: 10 }}>+{granted.length - 6}</span>
                          )}
                        </div>
                        {(extras.length > 0 || revoked.length > 0) && (
                          <div style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>
                            {extras.length > 0 && <span>إضافي: {extras.length} · </span>}
                            {revoked.length > 0 && <span>ملغى من الافتراضي: {revoked.length}</span>}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: 'left' }}>
                    <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setEditing(u)}>
                      تعديل الصلاحيات
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showNew && <NewStaffModal demo={demo} onClose={() => setShowNew(false)} />}
      {editing && <EditPermissionsModal user={editing} demo={demo} onClose={() => setEditing(null)} />}
    </div>
  );
}
