import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { orderBy, where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import SearchInput from '../../components/SearchInput';
import { ErrorBanner, Field } from '../../components/ui';
import { useMyClasses } from '../../hooks/useMyClasses';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { demoEnrollments, demoObservations } from '../../data/demo';
import { relativeDaysAr, relativeFromTimestamp } from '../../lib/relativeTime';
import { createObservation } from '../../services/observations';
import { filterByStudentSearch, matchesStudentSearch } from '../../lib/studentSearch';

const KINDS = ['أكاديمي', 'سلوكي', 'اجتماعي', 'صحّي'];
const SENTIMENTS = ['إيجابي', 'محايد', 'ملاحظة'];

export default function Observations() {
  const [params] = useSearchParams();
  const { myClasses, profile, demo, error } = useMyClasses();
  const [classId, setClassId] = useState(params.get('class') || '');
  const activeClassId = classId || myClasses[0]?.id || '';
  const activeClass = myClasses.find((c) => c.id === activeClassId);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fromUrl = params.get('class');
    if (fromUrl) setClassId(fromUrl);
  }, [params]);

  const { data: enrolled } = useLiveOrDemo(
    activeClassId ? `classes/${activeClassId}/enrollments` : '__none__',
    [orderBy('enrolledAt', 'asc')],
    demoEnrollments[activeClassId] || Object.values(demoEnrollments)[0] || [],
  );
  const enrolledOptions = useMemo(() => filterByStudentSearch(enrolled, search), [enrolled, search]);

  const { data: liveObs } = useLiveOrDemo(
    'observations',
    [where('teacherId', '==', profile?.id || '__none__'), orderBy('createdAt', 'desc')],
    demoObservations.map((o, i) => ({
      id: `obs-${i}`,
      studentName: o.student,
      kind: o.kind,
      sentiment: o.sentiment,
      note: o.note,
      daysAgo: o.daysAgo,
      className: activeClass?.title,
    })),
    profile?.id,
  );

  const [localObs, setLocalObs] = useState([]);
  const list = useMemo(() => {
    const base = demo ? [...localObs, ...liveObs] : liveObs;
    const scoped = activeClassId
      ? base.filter((o) => !o.classId || o.classId === activeClassId || demo)
      : base;
    return scoped.filter((o) => matchesStudentSearch(o, search));
  }, [demo, localObs, liveObs, activeClassId, search]);

  const [studentId, setStudentId] = useState('');
  const [kind, setKind] = useState(KINDS[0]);
  const [sentiment, setSentiment] = useState(SENTIMENTS[0]);
  const [note, setNote] = useState('');
  const [visibleToParent, setVisibleToParent] = useState(false);
  const [visibleToStudent, setVisibleToStudent] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const onSave = async (e) => {
    e.preventDefault();
    const student = enrolled.find((s) => (s.studentId || s.id) === studentId);
    if (!student || !note.trim()) return;
    setSaving(true);
    setMessage('');
    try {
      const payload = {
        studentId: student.studentId || student.id,
        studentName: student.studentName || student.name,
        classId: activeClassId,
        className: activeClass?.title,
        teacherId: profile?.id,
        teacherName: profile?.name || 'معلّم',
        kind, sentiment, note, visibleToParent, visibleToStudent,
      };
      if (demo) {
        setLocalObs((l) => [{
          id: `local-${Date.now()}`,
          ...payload,
          daysAgo: 0,
        }, ...l]);
        setMessage('حُفظت الملاحظة (عرض توضيحي).');
      } else {
        await createObservation(payload);
        setMessage('حُفظت الملاحظة ورُبطت بملف الطالب.');
      }
      setStudentId('');
      setNote('');
      setVisibleToParent(false);
      setVisibleToStudent(true);
    } catch {
      setMessage('تعذّر حفظ الملاحظة.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, alignItems: 'start' }} className="ah-2col">
      <div className="card">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
          <div className="card-title" style={{ margin: 0 }}>ملاحظات صفوفي</div>
          <select className="input" style={{ width: 'auto', fontSize: 13, marginInlineStart: 'auto' }} value={activeClassId} onChange={(e) => { setClassId(e.target.value); setStudentId(''); setSearch(''); }}>
            {myClasses.length === 0 && <option value="">لا صفوف</option>}
            {myClasses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="بحث عن طالب…"
          style={{ marginBottom: 12, maxWidth: '100%' }}
        />
        <ErrorBanner>{error && 'تعذّر تحميل البيانات.'}</ErrorBanner>
        {list.length === 0 && <div style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>لا ملاحظات بعد لهذا الصف.</div>}
        {list.map((o) => (
          <div key={o.id} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
            <div style={{ width: 34, height: 34, flex: 'none', borderRadius: '50%', background: 'var(--color-neutral-200)', display: 'grid', placeItems: 'center' }}>
              <Icon name="person" size={15} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 14 }}>{o.studentName || o.student}</strong>
                <span className="tag tag-neutral" style={{ fontSize: 9 }}>{o.kind}</span>
                <span className={`tag ${o.sentiment === 'إيجابي' ? 'tag-accent' : 'tag-accent-2'}`} style={{ fontSize: 9 }}>{o.sentiment}</span>
                {o.className && <span style={{ fontSize: 11, color: 'var(--color-neutral-500)' }}>{o.className}</span>}
                <span style={{ marginInlineStart: 'auto', fontSize: 11, color: 'var(--color-neutral-500)' }}>
                  {o.daysAgo != null ? relativeDaysAr(o.daysAgo) : relativeFromTimestamp(o.createdAt)}
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 4 }}>{o.note}</div>
            </div>
          </div>
        ))}
      </div>

      <form className="card" onSubmit={onSave}>
        <div className="card-title" style={{ marginBottom: 8 }}>ملاحظة جديدة</div>
        <Field label="الطالب (من طلاب صفّك)">
          <select className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
            <option value="" disabled>اختر طالباً…</option>
            {enrolledOptions.map((s) => (
              <option key={s.studentId || s.id} value={s.studentId || s.id}>
                {s.studentName || s.name} — {s.displayId || ''}
              </option>
            ))}
          </select>
        </Field>
        <div className="field" style={{ marginTop: 10 }}>
          <label>النوع</label>
          <div className="seg" style={{ marginTop: 2 }}>
            {KINDS.map((k) => <label key={k} className="seg-opt"><input type="radio" name="ok" checked={kind === k} onChange={() => setKind(k)} /><span>{k}</span></label>)}
          </div>
        </div>
        <div className="field" style={{ marginTop: 10 }}>
          <label>الانطباع</label>
          <div className="seg" style={{ marginTop: 2 }}>
            {SENTIMENTS.map((s) => <label key={s} className="seg-opt"><input type="radio" name="sn" checked={sentiment === s} onChange={() => setSentiment(s)} /><span>{s}</span></label>)}
          </div>
        </div>
        <Field label="الملاحظة">
          <textarea className="input" placeholder="اكتب ملاحظة قصيرة…" value={note} onChange={(e) => setNote(e.target.value)} required />
        </Field>
        <label className="radio" style={{ marginTop: 10 }}>
          <input type="checkbox" checked={visibleToStudent} onChange={(e) => setVisibleToStudent(e.target.checked)} />
          <span className="dot" /> مرئية للطالب في بوابته
        </label>
        <label className="radio" style={{ marginTop: 6 }}>
          <input type="checkbox" checked={visibleToParent} onChange={(e) => setVisibleToParent(e.target.checked)} />
          <span className="dot" /> مرئية لولي الأمر
        </label>
        {message && <div style={{ fontSize: 12, color: 'var(--color-accent-700)', marginTop: 8 }}>{message}</div>}
        <button type="submit" className="btn btn-primary btn-block" disabled={saving || !enrolled.length}>
          {saving ? 'جارٍ الحفظ…' : 'حفظ الملاحظة'}
        </button>
      </form>
    </div>
  );
}
