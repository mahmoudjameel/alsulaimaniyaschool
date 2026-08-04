import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export const notificationsCol = collection(db, 'notifications');

/**
 * Targeted in-app notification (teacher / admin / parent / student).
 * `userId` is the Auth UID of the recipient.
 */
export async function createNotification({
  userId,
  role = 'teacher',
  type,
  title,
  body,
  studentId = null,
  studentName = null,
  classId = null,
  link = null,
  meta = null,
}) {
  if (!userId) return null;
  const ref = await addDoc(notificationsCol, {
    userId,
    role,
    type: type || 'info',
    title: title || '',
    body: body || '',
    studentId,
    studentName,
    classId,
    link,
    meta: meta || null,
    read: false,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function notifyMany(userIds, payload) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  await Promise.all(ids.map((userId) => createNotification({ ...payload, userId })));
}

export async function markNotificationRead(id) {
  await updateDoc(doc(db, 'notifications', id), {
    read: true,
    readAt: serverTimestamp(),
  });
}

export async function markNotificationsRead(ids) {
  await Promise.all((ids || []).map((id) => markNotificationRead(id)));
}
