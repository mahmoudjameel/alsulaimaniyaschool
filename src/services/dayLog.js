import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { logActivity } from './activity';

/** One day-log per class per calendar date (id = YYYY-MM-DD). */
export async function saveDayLog({
  classId, className, subject, teacherId, teacherName, date, topic, homework, notice,
}) {
  const ref = doc(db, 'classes', classId, 'dayLogs', date);
  await setDoc(ref, {
    date,
    classId,
    className: className || '',
    subject: subject || '',
    teacherId,
    teacherName: teacherName || '',
    topic: (topic || '').trim(),
    homework: (homework || '').trim(),
    notice: (notice || '').trim(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  await logActivity({
    type: 'day_log_saved',
    actorUid: teacherId,
    actorName: teacherName,
    actorRole: 'teacher',
    summary: `دفتر يوم ${date} — ${className || classId}`,
    targetType: 'class',
    targetId: classId,
  });
}
