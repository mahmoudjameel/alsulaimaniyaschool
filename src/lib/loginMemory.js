/** Last successful login identifiers (never stores passwords). */
const STORAGE_KEY = 'alsula-last-login';

export function loadLastLogin() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveLastLogin(payload) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      role: payload.role || null,
      email: payload.email || null,
      phoneDial: payload.phoneDial || null,
      phoneLocal: payload.phoneLocal || null,
      studentId: payload.studentId || null,
      savedAt: Date.now(),
    }));
  } catch {
    // ignore quota / private mode
  }
}

export function clearLastLogin() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function homePathForRole(role) {
  if (role === 'admin' || role === 'director') return '/admin';
  if (role === 'teacher') return '/teacher';
  if (role === 'accountant') return '/accountant';
  if (role === 'reception') return '/reception';
  if (role === 'parent') return '/parent';
  if (role === 'student') return '/student';
  return '/';
}
