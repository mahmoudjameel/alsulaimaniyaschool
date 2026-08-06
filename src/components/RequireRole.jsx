import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isAdminShellRole } from '../lib/permissions';
import { Loader } from './ui';

/**
 * Gate a route by one or more roles.
 * `role` — string or string[] (e.g. "admin" or ["admin","director"]).
 * Login redirect uses the first role in the list.
 */
export default function RequireRole({ role, children }) {
  const { firebaseUser, role: userRole, loading, isFirebaseConfigured } = useAuth();
  const location = useLocation();
  const allowed = Array.isArray(role) ? role : [role];
  const loginRole = allowed[0] || 'admin';

  if (!isFirebaseConfigured) {
    return children;
  }
  if (loading) return <Loader label="جارٍ التحقق من الجلسة…" />;
  if (!firebaseUser) return <Navigate to={`/login/${loginRole}`} replace state={{ from: location }} />;
  if (!userRole || !allowed.includes(userRole)) return <Navigate to="/" replace />;
  return children;
}

/** Convenience: admin shell (إدارة + مديرة). */
export function RequireAdminShell({ children }) {
  return <RequireRole role={['admin', 'director']}>{children}</RequireRole>;
}

export { isAdminShellRole };
