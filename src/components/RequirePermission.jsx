import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader } from './ui';

/** Block a route unless the signed-in user has the given permission. */
export default function RequirePermission({ permission, children, fallback = '/admin' }) {
  const { can, loading, isFirebaseConfigured, firebaseUser } = useAuth();
  const location = useLocation();

  if (!isFirebaseConfigured) return children;
  if (loading) return <Loader label="جارٍ التحقق من الصلاحية…" />;
  if (!firebaseUser) return <Navigate to="/login/admin" replace state={{ from: location }} />;
  if (permission && !can(permission)) {
    return <Navigate to={fallback} replace />;
  }
  return children;
}
