import { useState } from 'react';
import Modal from '../components/Modal';
import { Field } from '../components/ui';
import { updateUserAccess } from '../services/users';
import {
  PERMISSIONS, ROLE_DEFAULT_PERMISSIONS, ROLE_LABELS, STAFF_ROLES,
  permissionGroups, permissionsForUser, serializePermissions,
} from '../lib/permissions';

export default function EditPermissionsModal({ user, onClose, demo }) {
  const [role, setRole] = useState(user.role);
  const [perms, setPerms] = useState(() => permissionsForUser(user));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const groups = permissionGroups();
  const defaults = ROLE_DEFAULT_PERMISSIONS[role] || {};
  const toggle = (key) => setPerms((p) => ({ ...p, [key]: !p[key] }));
  const isFullAdmin = role === 'admin';

  const onRoleChange = (nextRole) => {
    setRole(nextRole);
    setPerms(permissionsForUser({
      ...user,
      role: nextRole,
      permissions: ROLE_DEFAULT_PERMISSIONS[nextRole] || {},
    }));
  };

  const resetDefaults = () => {
    setPerms({ ...(ROLE_DEFAULT_PERMISSIONS[role] || {}) });
  };

  const grantAll = () => {
    setPerms(Object.fromEntries(PERMISSIONS.map((p) => [p.key, true])));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (demo) { setError('وضع العرض التوضيحي: صِل مشروع Firebase لحفظ الصلاحيات فعلياً.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await updateUserAccess(user.id, {
        role,
        permissions: isFullAdmin ? {} : serializePermissions(perms),
      });
      onClose();
    } catch {
      setError('تعذّر حفظ التغييرات.');
    } finally {
      setSubmitting(false);
    }
  };

  const grantedCount = PERMISSIONS.filter((p) => perms[p.key]).length;

  return (
    <Modal title={`صلاحيات ${user.name}`} onClose={onClose} onSubmit={onSubmit} submitLabel="حفظ الصلاحيات" submitting={submitting} error={error} width={560}>
      <Field label="الدور">
        <select className="input" value={role} onChange={(e) => onRoleChange(e.target.value)}>
          {STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
      </Field>

      {isFullAdmin ? (
        <div className="dialog-body">
          حساب <strong>الإدارة</strong> يملك كل الصلاحيات دائماً ولا يمكن تقييده.
          لتعيين صلاحيات محدودة استخدمي دور <strong>المديرة</strong> ثم فعّلي الشاشات أدناه.
        </div>
      ) : (
        <>
          {role === 'director' && (
            <div className="dialog-body" style={{ marginBottom: 8 }}>
              دور المديرة يدخل لوحة الإدارة. الافتراضي: طلاب وأكاديمي بدون مالية كاملة وبدون مستخدمين/نسخ احتياطي — عدّلي حسب الحاجة.
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>{grantedCount} من {PERMISSIONS.length} صلاحية مفعّلة</span>
            <span style={{ marginInlineStart: 'auto' }} />
            <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={resetDefaults}>استعادة افتراضي الدور</button>
            <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={grantAll}>منح الكل</button>
          </div>
          <div className="dialog-body" style={{ marginBottom: 4 }}>
            كل مربع يفتح شاشة أو إجراء في النظام. الافتراضي يظهر بعلامة «افتراضي».
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '50vh', overflow: 'auto', paddingInlineEnd: 4 }}>
            {groups.map((g) => (
              <div key={g}>
                <div style={{ fontSize: 11, letterSpacing: '.06em', color: 'var(--gold)', marginBottom: 8, fontWeight: 600 }}>{g}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {PERMISSIONS.filter((p) => p.group === g).map((p) => {
                    const isDefault = !!defaults[p.key];
                    const checked = !!perms[p.key];
                    return (
                      <label key={p.key} className="radio" style={{ alignItems: 'flex-start', gap: 10 }}>
                        <input type="checkbox" checked={checked} onChange={() => toggle(p.key)} style={{ marginTop: 3 }} />
                        <span className="dot" style={{ marginTop: 3 }} />
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span>{p.label}</span>
                            {isDefault && <span className="tag tag-neutral" style={{ fontSize: 9 }}>افتراضي</span>}
                            {checked && !isDefault && <span className="tag tag-accent" style={{ fontSize: 9 }}>إضافي</span>}
                            {!checked && isDefault && <span className="tag tag-outline" style={{ fontSize: 9 }}>ملغى</span>}
                          </span>
                          {p.description && (
                            <span style={{ fontSize: 11, color: 'var(--color-neutral-500)', lineHeight: 1.5 }}>{p.description}</span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
