import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader } from './ui';

export default function RequireRole({ role, children }) {
  const { firebaseUser, role: userRole, loading, isFirebaseConfigured } = useAuth();
  const location = useLocation();

  if (!isFirebaseConfigured) {
    // No Firebase project connected yet — let the demo UI render so the
    // design/flow can still be reviewed without a backend.
    return children;
  }
  if (loading) return <Loader label="جارٍ التحقق من الجلسة…" />;
  if (!firebaseUser) return <Navigate to={`/login/${role}`} replace state={{ from: location }} />;
  if (userRole && userRole !== role) return <Navigate to="/" replace />;
  return children;
}
