import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
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
