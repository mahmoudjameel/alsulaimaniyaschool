import { useCallback, useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { isFirebaseConfigured } from '../firebase/config';
import { localDateKey } from '../lib/geo';
import {
  formatPunchTime,
  punchCheckIn,
  punchCheckOut,
  punchErrorMessage,
  todayAttendanceRef,
} from '../services/staffPunch';
import { PUNCH_STATUS, punchSuccessMessage } from '../lib/punchCopy';

/**
 * Live today punch state + check-in/out for signed-in staff
 * (teacher, accountant, reception).
 */
export function useTeacherPunch() {
  const { profile, firebaseUser, isFirebaseConfigured: cfg } = useAuth();
  const uid = firebaseUser?.uid || profile?.id;
  const [day, setDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const dateKey = localDateKey();

  useEffect(() => {
    if (!cfg || !isFirebaseConfigured || !uid) {
      setDay(null);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const unsub = onSnapshot(
      todayAttendanceRef(uid, dateKey),
      (snap) => {
        setDay(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setLoading(false);
      },
      () => {
        setDay(null);
        setLoading(false);
      },
    );
    return unsub;
  }, [cfg, uid, dateKey]);

  const run = useCallback(async (action) => {
    if (!uid) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (!cfg || !isFirebaseConfigured) {
        setError('تعذّر الاتصال بسجلّ الدوام. راجع الإدارة الفنية.');
        return;
      }
      const actor = { ...profile, uid, id: profile?.id || uid };
      if (action === 'in') {
        const res = await punchCheckIn({
          teacherUid: uid,
          teacherName: profile?.name,
          actor,
          staffRole: profile?.role,
        });
        setMessage(punchSuccessMessage('in', res.distanceM));
      } else {
        const res = await punchCheckOut({
          teacherUid: uid,
          teacherName: profile?.name,
          actor,
          staffRole: profile?.role,
        });
        setMessage(punchSuccessMessage('out', res.distanceM));
      }
    } catch (err) {
      setError(punchErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [uid, cfg, profile]);

  const checkedIn = Boolean(day?.checkInAt);
  const checkedOut = Boolean(day?.checkOutAt);
  const status = checkedOut ? PUNCH_STATUS.done : checkedIn ? PUNCH_STATUS.in : PUNCH_STATUS.none;

  return {
    day,
    dateKey,
    loading,
    busy,
    message,
    error,
    checkedIn,
    checkedOut,
    status,
    checkInTime: formatPunchTime(day?.checkInAt),
    checkOutTime: formatPunchTime(day?.checkOutAt),
    checkIn: () => run('in'),
    checkOut: () => run('out'),
  };
}

/** Alias — same hook for all staff portals. */
export const useStaffPunch = useTeacherPunch;
