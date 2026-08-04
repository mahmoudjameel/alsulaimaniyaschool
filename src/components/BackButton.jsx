import { useNavigate, useLocation } from 'react-router-dom';
import Icon from './Icon';

function homeForPath(pathname) {
  if (pathname.startsWith('/reception')) return '/reception';
  if (pathname.startsWith('/accountant')) return '/accountant';
  if (pathname.startsWith('/admin')) return '/admin';
  if (pathname.startsWith('/parent')) return '/parent';
  if (pathname.startsWith('/teacher')) return '/teacher';
  if (pathname.startsWith('/student')) return '/student';
  if (pathname.startsWith('/site')) return '/site';
  return '/';
}

/**
 * Reliable back control. Always navigates to `to` when provided.
 * Otherwise uses router history when available, else portal home.
 */
export default function BackButton({
  to,
  label = 'رجوع',
  className = 'btn btn-ghost',
  style,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const fallback = to || homeForPath(location.pathname);

  const onBack = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    navigate(fallback);
  };

  return (
    <button
      type="button"
      className={className}
      style={{ alignSelf: 'flex-start', fontSize: 13, ...style }}
      onClick={onBack}
    >
      <Icon name="arrow_forward" size={15} /> {label}
    </button>
  );
}
