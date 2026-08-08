import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export const articlesCol = collection(db, 'articles');
export const announcementsCol = collection(db, 'announcements');
export const commentsCol = collection(db, 'comments');

export async function createArticle({ title, author, category, excerpt, status = 'مسودّة' }) {
  await addDoc(articlesCol, {
    title: title || 'مقال جديد',
    author: author || 'الإدارة',
    category: category || 'أخبار',
    excerpt: excerpt || '',
    status,
    tone: status === 'منشور' ? 'accent' : 'neutral',
    date: new Date().toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' }),
    createdAt: serverTimestamp(),
  });
}

export async function updateArticle(id, { title, author, category, excerpt, status }) {
  const patch = { updatedAt: serverTimestamp() };
  if (title != null) patch.title = title;
  if (author != null) patch.author = author;
  if (category != null) patch.category = category;
  if (excerpt != null) patch.excerpt = excerpt;
  if (status != null) {
    patch.status = status;
    patch.tone = status === 'منشور' ? 'accent' : 'neutral';
  }
  await updateDoc(doc(db, 'articles', id), patch);
}

export async function deleteArticle(id) {
  await deleteDoc(doc(db, 'articles', id));
}

export async function createAnnouncement({ title, audience, body, status = 'مسودّة' }) {
  await addDoc(announcementsCol, {
    title: title || 'إعلان جديد',
    audience: audience || 'الجميع',
    body: body || '',
    status,
    tone: status === 'منشور' ? 'accent' : 'neutral',
    date: new Date().toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' }),
    createdAt: serverTimestamp(),
  });
}

export async function updateAnnouncement(id, { title, audience, body, status }) {
  const patch = { updatedAt: serverTimestamp() };
  if (title != null) patch.title = title;
  if (audience != null) patch.audience = audience;
  if (body != null) patch.body = body;
  if (status != null) {
    patch.status = status;
    patch.tone = status === 'منشور' ? 'accent' : 'neutral';
  }
  await updateDoc(doc(db, 'announcements', id), patch);
}

export async function deleteAnnouncement(id) {
  await deleteDoc(doc(db, 'announcements', id));
}

export async function publishArticle(articleId) {
  await updateDoc(doc(db, 'articles', articleId), { status: 'منشور', tone: 'accent' });
}

export async function publishAnnouncement(announcementId) {
  await updateDoc(doc(db, 'announcements', announcementId), { status: 'منشور', tone: 'accent' });
}

export async function moderateComment(commentId, decision) {
  await updateDoc(doc(db, 'comments', commentId), {
    status: decision === 'approve' ? 'معتمَد' : 'محظور',
  });
}
