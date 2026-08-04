import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import { logActivity } from './activity';

/**
 * Saves one class's attendance for one date in a single batch: the
 * class-level session doc (id = date, one place to browse a class's whole
 * history) and a mirrored per-student record (id = `${classId}_${date}`,
 * idempotent on re-save) so a student's/parent's history is a flat,
 * ordered subcollection instead of a fan-out query across every class.
 */
export async function submitAttendance({
  classId, className, subject, teacherId, teacherName, shift, date, records, takenByName,
}) {
  const batch = writeBatch(db);

  const recordsMap = Object.fromEntries(
    records.map((r) => [r.studentId, { studentName: r.studentName, status: r.status }])
  );
  batch.set(doc(db, 'classes', classId, 'attendanceSessions', date), {
    date, classId, className, subject, teacherId, teacherName, shift: shift || null,
    records: recordsMap, takenByName: takenByName || '—', updatedAt: serverTimestamp(),
  });

  for (const r of records) {
    batch.set(doc(db, 'students', r.studentId, 'attendanceRecords', `${classId}_${date}`), {
      date, classId, className, subject, teacherId, teacherName, status: r.status, updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
  await logActivity({
    type: 'attendance_taken', actorUid: teacherId, actorName: teacherName, actorRole: 'teacher',
    summary: `تسجيل حضور ${className} — ${date} (${records.length} طالباً)`,
    targetType: 'class', targetId: classId,
  });
}
