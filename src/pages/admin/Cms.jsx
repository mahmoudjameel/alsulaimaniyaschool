import { useState } from 'react';
import { orderBy } from 'firebase/firestore';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import { SegmentedTabs, ErrorBanner, EmptyRow, Field } from '../../components/ui';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { useAuth } from '../../context/AuthContext';
import { demoArticles, demoAnnouncements, demoComments } from '../../data/demo';
import {
  createArticle, createAnnouncement, moderateComment, publishArticle, publishAnnouncement,
  updateArticle, deleteArticle, updateAnnouncement, deleteAnnouncement,
} from '../../services/content';

const TABS = [
  { id: 'articles', label: 'المقالات', newLabel: 'مقال جديد' },
  { id: 'ann', label: 'الإعلانات', newLabel: 'إعلان جديد' },
  { id: 'comments', label: 'التعليقات', newLabel: 'تحديث الإشراف' },
];

export default function Cms() {
  const { profile } = useAuth();
  const [tab, setTab] = useState('articles');
  const articles = useLiveOrDemo('articles', [orderBy('createdAt', 'desc')], demoArticles);
  const announcements = useLiveOrDemo('announcements', [orderBy('createdAt', 'desc')], demoAnnouncements);
  const comments = useLiveOrDemo('comments', [orderBy('createdAt', 'desc')], demoComments);
  const [busyId, setBusyId] = useState(null);
  const [localComments, setLocalComments] = useState({});
  const [showNew, setShowNew] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);
  const [editingAnn, setEditingAnn] = useState(null);

  const active = { articles, ann: announcements, comments }[tab];
  const current = TABS.find((t) => t.id === tab);
  const demo = articles.demo || announcements.demo;

  const onModerate = async (row, decision) => {
    setBusyId(row.id);
    try {
      if (comments.demo) {
        setLocalComments((s) => ({ ...s, [row.id || row.author]: decision === 'approve' ? 'معتمَد' : 'محظور' }));
      } else {
        await moderateComment(row.id, decision);
      }
    } finally {
      setBusyId(null);
    }
  };

  const onPublish = async (row, kind) => {
    if (demo) return;
    setBusyId(row.id);
    try {
      if (kind === 'article') await publishArticle(row.id);
      else await publishAnnouncement(row.id);
    } finally {
      setBusyId(null);
    }
  };

  const onDeleteArticle = async (row) => {
    if (demo || !row?.id) return;
    if (!window.confirm(`حذف المقال «${row.title}»؟`)) return;
    setBusyId(row.id);
    try {
      await deleteArticle(row.id);
    } catch {
      window.alert('تعذّر الحذف.');
    } finally {
      setBusyId(null);
    }
  };

  const onDeleteAnn = async (row) => {
    if (demo || !row?.id) return;
    if (!window.confirm(`حذف الإعلان «${row.title}»؟`)) return;
    setBusyId(row.id);
    try {
      await deleteAnnouncement(row.id);
    } catch {
      window.alert('تعذّر الحذف.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ErrorBanner>{active.error && 'تعذّر تحميل المحتوى.'}</ErrorBanner>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <SegmentedTabs tabs={TABS.map((t) => ({ ...t, active: tab === t.id, onClick: () => setTab(t.id) }))} />
        {tab !== 'comments' && (
          <button type="button" className="btn btn-primary" style={{ marginInlineStart: 'auto', fontSize: 13 }} onClick={() => setShowNew(true)}>
            <Icon name="add" size={14} /> {current.newLabel}
          </button>
        )}
      </div>

      {tab === 'articles' && (
        <div className="card ah-table-wrap" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>العنوان</th><th>الكاتب</th><th>الفئة</th><th>الحالة</th><th>النشر</th><th /></tr></thead>
            <tbody>
              {articles.data.length === 0 && <EmptyRow colSpan={6}>لا توجد مقالات بعد.</EmptyRow>}
              {articles.data.map((a, i) => (
                <tr key={a.id || i}>
                  <td>{a.title}</td><td>{a.author}</td>
                  <td><span className="tag tag-neutral">{a.category}</span></td>
                  <td><span className={`tag tag-${a.tone || 'neutral'}`}>{a.status}</span></td>
                  <td className="ah-tabnum" style={{ color: 'var(--color-neutral-500)' }}>{a.date}</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>
                    <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} disabled={demo || !a.id} onClick={() => setEditingArticle(a)}>تعديل</button>
                    {a.status !== 'منشور' && a.id && (
                      <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} disabled={busyId === a.id} onClick={() => onPublish(a, 'article')}>نشر</button>
                    )}
                    <button type="button" className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--color-accent-2-700)' }} disabled={demo || busyId === a.id} onClick={() => onDeleteArticle(a)}>حذف</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'ann' && (
        <div className="card ah-table-wrap" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>الإعلان</th><th>الفئة المستهدفة</th><th>الحالة</th><th>التاريخ</th><th /></tr></thead>
            <tbody>
              {announcements.data.length === 0 && <EmptyRow colSpan={5}>لا توجد إعلانات بعد.</EmptyRow>}
              {announcements.data.map((a, i) => (
                <tr key={a.id || i}>
                  <td>{a.title}</td>
                  <td><span className="tag tag-outline">{a.audience}</span></td>
                  <td><span className={`tag tag-${a.tone || 'neutral'}`}>{a.status}</span></td>
                  <td className="ah-tabnum" style={{ color: 'var(--color-neutral-500)' }}>{a.date}</td>
                  <td style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>
                    <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} disabled={demo || !a.id} onClick={() => setEditingAnn(a)}>تعديل</button>
                    {a.status !== 'منشور' && a.id && (
                      <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} disabled={busyId === a.id} onClick={() => onPublish(a, 'ann')}>نشر</button>
                    )}
                    <button type="button" className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--color-accent-2-700)' }} disabled={demo || busyId === a.id} onClick={() => onDeleteAnn(a)}>حذف</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'comments' && (
        <div className="card ah-table-wrap" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>الكاتب</th><th>على</th><th>التعليق</th><th>الحالة</th><th /></tr></thead>
            <tbody>
              {comments.data.length === 0 && <EmptyRow colSpan={5}>لا توجد تعليقات بعد.</EmptyRow>}
              {comments.data.map((c, i) => {
                const status = localComments[c.id || c.author] || c.status;
                return (
                  <tr key={c.id || i}>
                    <td>{c.author}</td>
                    <td style={{ color: 'var(--color-neutral-500)' }}>{c.on}</td>
                    <td>{c.text}</td>
                    <td><span className={`tag tag-${status === 'معتمَد' ? 'accent' : status === 'محظور' ? 'neutral' : 'outline'}`}>{status}</span></td>
                    <td style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>
                      <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} disabled={busyId === c.id} onClick={() => onModerate(c, 'approve')}>اعتماد</button>{' '}
                      <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} disabled={busyId === c.id} onClick={() => onModerate(c, 'block')}>حظر</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showNew && tab === 'articles' && (
        <NewArticleModal
          demo={demo}
          author={profile?.name || 'إدارة المدرسة'}
          onClose={() => setShowNew(false)}
        />
      )}
      {showNew && tab === 'ann' && (
        <NewAnnouncementModal demo={demo} onClose={() => setShowNew(false)} />
      )}
      {editingArticle && (
        <EditArticleModal
          article={editingArticle}
          demo={demo}
          onClose={() => setEditingArticle(null)}
        />
      )}
      {editingAnn && (
        <EditAnnouncementModal
          ann={editingAnn}
          demo={demo}
          onClose={() => setEditingAnn(null)}
        />
      )}
    </div>
  );
}

function NewArticleModal({ demo, author, onClose }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('أخبار');
  const [excerpt, setExcerpt] = useState('');
  const [publishNow, setPublishNow] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    if (demo) { setError('وضع العرض التوضيحي: صِل Firebase للحفظ.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await createArticle({
        title, author, category, excerpt,
        status: publishNow ? 'منشور' : 'مسودّة',
      });
      onClose();
    } catch {
      setError('تعذّر حفظ المقال.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="مقال جديد" onClose={onClose} onSubmit={onSubmit} submitLabel="حفظ" submitting={submitting} error={error} width={520}>
      <Field label="العنوان"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required /></Field>
      <Field label="الفئة">
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option>أخبار</option><option>أنشطة</option><option>إرشادات</option><option>مناسبات</option>
        </select>
      </Field>
      <Field label="مقتطف"><textarea className="input" rows={4} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} /></Field>
      <label className="radio"><input type="checkbox" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} /><span className="dot" /> نشر فوراً على الموقع</label>
    </Modal>
  );
}

function NewAnnouncementModal({ demo, onClose }) {
  const [title, setTitle] = useState('');
  const [audience, setAudience] = useState('الجميع');
  const [body, setBody] = useState('');
  const [publishNow, setPublishNow] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    if (demo) { setError('وضع العرض التوضيحي: صِل Firebase للحفظ.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await createAnnouncement({
        title, audience, body,
        status: publishNow ? 'منشور' : 'مسودّة',
      });
      onClose();
    } catch {
      setError('تعذّر حفظ الإعلان.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="إعلان جديد" onClose={onClose} onSubmit={onSubmit} submitLabel="حفظ" submitting={submitting} error={error}>
      <Field label="العنوان"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required /></Field>
      <Field label="الجمهور">
        <select className="input" value={audience} onChange={(e) => setAudience(e.target.value)}>
          <option>الجميع</option><option>أولياء الأمور</option><option>المعلّمون</option><option>الطلاب</option>
        </select>
      </Field>
      <Field label="النص"><textarea className="input" rows={4} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
      <label className="radio"><input type="checkbox" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} /><span className="dot" /> نشر فوراً</label>
    </Modal>
  );
}

function EditArticleModal({ article, demo, onClose }) {
  const [title, setTitle] = useState(article?.title || '');
  const [category, setCategory] = useState(article?.category || 'أخبار');
  const [excerpt, setExcerpt] = useState(article?.excerpt || '');
  const [status, setStatus] = useState(article?.status || 'مسودّة');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    if (demo) { setError('صِل Firebase للحفظ.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await updateArticle(article.id, { title, category, excerpt, status });
      onClose();
    } catch {
      setError('تعذّر حفظ التعديل.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="تعديل المقال" onClose={onClose} onSubmit={onSubmit} submitLabel="حفظ" submitting={submitting} error={error} width={520}>
      <Field label="العنوان"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required /></Field>
      <Field label="الفئة">
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option>أخبار</option><option>أنشطة</option><option>إرشادات</option><option>مناسبات</option>
        </select>
      </Field>
      <Field label="مقتطف"><textarea className="input" rows={4} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} /></Field>
      <Field label="الحالة">
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option>مسودّة</option><option>منشور</option>
        </select>
      </Field>
    </Modal>
  );
}

function EditAnnouncementModal({ ann, demo, onClose }) {
  const [title, setTitle] = useState(ann?.title || '');
  const [audience, setAudience] = useState(ann?.audience || 'الجميع');
  const [body, setBody] = useState(ann?.body || '');
  const [status, setStatus] = useState(ann?.status || 'مسودّة');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    if (demo) { setError('صِل Firebase للحفظ.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await updateAnnouncement(ann.id, { title, audience, body, status });
      onClose();
    } catch {
      setError('تعذّر حفظ التعديل.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="تعديل الإعلان" onClose={onClose} onSubmit={onSubmit} submitLabel="حفظ" submitting={submitting} error={error}>
      <Field label="العنوان"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required /></Field>
      <Field label="الجمهور">
        <select className="input" value={audience} onChange={(e) => setAudience(e.target.value)}>
          <option>الجميع</option><option>أولياء الأمور</option><option>المعلّمون</option><option>الطلاب</option>
        </select>
      </Field>
      <Field label="النص"><textarea className="input" rows={4} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
      <Field label="الحالة">
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option>مسودّة</option><option>منشور</option>
        </select>
      </Field>
    </Modal>
  );
}
