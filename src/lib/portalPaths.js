/** Resolve staff portal root from current pathname. */
export function staffPortalBase(pathname = '') {
  if (pathname.startsWith('/reception')) return '/reception';
  if (pathname.startsWith('/accountant')) return '/accountant';
  if (pathname.startsWith('/admin')) return '/admin';
  if (pathname.startsWith('/teacher')) return '/teacher';
  return '/admin';
}

export function studentsListPath(pathname) {
  const base = staffPortalBase(pathname);
  if (base === '/accountant') return '/accountant/enrollment';
  return `${base}/students`;
}

export function studentProfilePath(pathname, studentId) {
  const base = staffPortalBase(pathname);
  if (base === '/accountant') return `/admin/students/${studentId}`; // accountant has no profile route
  return `${base}/students/${studentId}`;
}
