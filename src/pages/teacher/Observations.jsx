import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { orderBy, where } from 'firebase/firestore';
import Icon from '../../components/Icon';
import SearchInput from '../../components/SearchInput';
import { ErrorBanner, SegmentedTabs } from '../../components/ui';
import { useMyClasses } from '../../hooks/useMyClasses';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { demoEnrollments, demoObservations } from '../../data/demo';
import { relativeDaysAr, relativeFromTimestamp } from '../../lib/relativeTime';
import { createObservation } from '../../services/observations';
import { filterByStudentSearch, matchesStudentSearch } from '../../lib/studentSearch';

/** Clear classroom scenarios — map to stored kind/sentiment for existing data. */
export const NOTE_SCENARIOS = [
  {
    id: 'praise',
    title: 'تشجيع وإنجاز',
    hint: 'مشاركة مميزة، تفوّق، سلوك حسن',
    icon: 'emoji_events',
    kind: 'أكاديمي',
    sentiment: 'إيجابي',
    audience: 'both',
    templates: [
      'شارك بفعالية في الحصة اليوم.',
      'أظهر تحسناً واضحاً في المتابعة والحل.',
      'يستحق التقدير على تعاونه مع زملائه.',
    ],
  },
  {
    id: 'academic',
    title: 'متابعة دراسية',
    hint: 'واجب ناقص، ضعف في الدرس، يحتاج دعم',
    icon: 'menu_book',
    kind: 'أكاديمي',
    sentiment: 'ملاحظة',
    audience: 'both',
    templates: [
      'يحتاج متابعة في فهم الدرس الحالي.',
      'لم يُسلّم الواجب المطلوب في الموعد.',
      'يُفضّل جلسة دعم قصيرة قبل الاختبار.',
    ],
  },
  {
    id: 'behavior',
    title: 'سلوك وانضباط',
    hint: 'هدوء الصف، احترام التعليمات، توجيه',
    icon: 'psychology',
    kind: 'سلوكي',
    sentiment: 'ملاحظة',
    audience: 'parent',
    templates: [
      'يحتاج تذكيراً بالالتزام بتعليمات الصف.',
      'أظهر تحسناً في الانضباط خلال الحصة.',
      'يُرجى التعاون مع المدرسة حول سلوك الصف.',
    ],
  },
  {
    id: 'social',
    title: 'اجتماعي / تواصل',
    hint: 'علاقته مع الزملاء أو المشاركة الجماعية',
    icon: 'groups',
    kind: 'اجتماعي',
    sentiment: 'محايد',
    audience: 'both',
    templates: [
      'يتحسّن تدريجياً في العمل الجماعي.',
      'يحتاج تشجيعاً للمشاركة مع زملائه.',
    ],
  },
  {
    id: 'health',
    title: 'صحّة وراحة',
    hint: 'تعب، صداع، حالة تحتاج إبلاغ الأسرة',
    icon: 'health_and_safety',
    kind: 'صحّي',
    sentiment: 'ملاحظة',
    audience: 'parent',
    templates: [
      'اشتكى من تعب خلال الحصة — يُرجى المتابعة.',
      'يُفضّل إبلاغ الأسرة بأي ملاحظة صحّية حديثة.',
    ],
  },
  {
    id: 'internal',
    title: 'للملف الداخلي فقط',
    hint: 'لا تظهر للطالب ولا لولي الأمر',
    icon: 'lock',
    kind: 'أكاديمي',
    sentiment: 'محايد',
    audience: 'none',
    templates: [
      'ملاحظة داخلية للمتابعة مع الإدارة.',
    ],
  },
];

const AUDIENCE_OPTIONS = [
  { id: 'none', label: 'داخلي فقط', desc: 'للإدارة والمعلّم — لا للطالب ولا لولي الأمر' },
  { id: 'student', label: 'الطالب', desc: 'تظهر في بوابة الطالب فقط' },
  { id: 'both', label: 'الطالب وولي الأمر', desc: 'الأنسب للمتابعة المنزلية' },
  { id: 'parent', label: 'ولي الأمر (+ الطالب)', desc: 'تنبيه أسري واضح مع إظهارها للطالب' },
];

function audienceFromFlags(visibleToStudent, visibleToParent) {
  if (visibleToParent) return 'parent';
  if (visibleToStudent) return 'student';
  return 'none';
}

function flagsFromAudience(audience) {
  if (audience === 'none') return { visibleToStudent: false, visibleToParent: false };
  if (audience === 'student') return { visibleToStudent: true, visibleToParent: false };
  // both + parent → student and parent see it
  return { visibleToStudent: true, visibleToParent: true };
}

function scenarioForObservation(o) {
  return NOTE_SCENARIOS.find((s) => s.kind === o.kind && s.sentiment === o.sentiment)
    || NOTE_SCENARIOS.find((s) => s.kind === o.kind)
    || null;
}

const LIST_FILTERS = [
  { id: 'all', label: 'الكل' },
  { id: 'إيجابي', label: 'تشجيع' },
  { id: 'متابعة', label: 'متابعة' },
];

export default function Observations() {
  const [params] = useSearchParams();
  const { myClasses, profile, demo, error } = useMyClasses();
  const [classId, setClassId] = useState(params.get('class') || '');
  const activeClassId = classId || myClasses[0]?.id || '';
  const activeClass = myClasses.find((c) => c.id === activeClassId);
  const [search, setSearch] = useState('');
  const [listFilter, setListFilter] = useState('all');

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
      classId: activeClassId,
      visibleToParent: true,
      visibleToStudent: true,
    })),
    profile?.id,
  );

  const [localObs, setLocalObs] = useState([]);
  const list = useMemo(() => {
    const base = demo ? [...localObs, ...liveObs] : liveObs;
    const scoped = activeClassId
      ? base.filter((o) => !o.classId || o.classId === activeClassId || demo)
      : base;
    const searched = scoped.filter((o) => matchesStudentSearch(o, search));
    if (listFilter === 'إيجابي') return searched.filter((o) => o.sentiment === 'إيجابي');
    if (listFilter === 'متابعة') return searched.filter((o) => o.sentiment !== 'إيجابي');
    return searched;
  }, [demo, localObs, liveObs, activeClassId, search, listFilter]);

  const [studentId, setStudentId] = useState('');
  const [scenarioId, setScenarioId] = useState(NOTE_SCENARIOS[0].id);
  const scenario = NOTE_SCENARIOS.find((s) => s.id === scenarioId) || NOTE_SCENARIOS[0];
  const [audience, setAudience] = useState(NOTE_SCENARIOS[0].audience);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setAudience(scenario.audience);
  }, [scenario.id, scenario.audience]);

  const onPickTemplate = (text) => {
    setNote((prev) => (prev.trim() ? `${prev.trim()}\n${text}` : text));
  };

  const onSave = async (e) => {
    e.preventDefault();
    const student = enrolled.find((s) => (s.studentId || s.id) === studentId);
    if (!student || !note.trim()) return;
    setSaving(true);
    setMessage('');
    const { visibleToStudent, visibleToParent } = flagsFromAudience(audience);
    try {
      const payload = {
        studentId: student.studentId || student.id,
        studentName: student.studentName || student.name,
        classId: activeClassId,
        className: activeClass?.title,
        teacherId: profile?.id,
        teacherName: profile?.name || 'معلّم',
        kind: scenario.kind,
        sentiment: scenario.sentiment,
        note: note.trim(),
        visibleToParent,
        visibleToStudent,
        scenarioId: scenario.id,
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
        setMessage('حُفظت الملاحظة وارتبطت بملف الطالب.');
      }
      setStudentId('');
      setNote('');
      setScenarioId(NOTE_SCENARIOS[0].id);
    } catch {
      setMessage('تعذّر حفظ الملاحظة.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)', lineHeight: 1.7 }}>
        اختر الصف والطالب، ثم نوع الموقف الدراسي — والنظام يضبط الظهور لولي الأمر/الطالب حسب السيناريو.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: 16, alignItems: 'start' }} className="ah-2col">
        <form className="card" onSubmit={onSave} style={{ gap: 14 }}>
          <div className="card-title" style={{ margin: 0 }}>ملاحظة جديدة — خطوة بخطوة</div>

          <div className="field">
            <label>1) الصف</label>
            <select
              className="input"
              value={activeClassId}
              onChange={(e) => { setClassId(e.target.value); setStudentId(''); setSearch(''); }}
            >
              {myClasses.length === 0 && <option value="">لا صفوف مسندة</option>}
              {myClasses.map((c) => (
                <option key={c.id} value={c.id}>{c.title} — {c.subject}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>2) الطالب</label>
            <SearchInput value={search} onChange={setSearch} placeholder="بحث بالاسم أو الرقم…" style={{ marginBottom: 8 }} />
            <select className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
              <option value="" disabled>اختر طالباً من كشف الصف…</option>
              {enrolledOptions.map((s) => (
                <option key={s.studentId || s.id} value={s.studentId || s.id}>
                  {s.studentName || s.name}{s.displayId ? ` — ${s.displayId}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>3) ماذا تريد تسجيله؟</label>
            <div style={{ display: 'grid', gap: 8, marginTop: 6 }}>
              {NOTE_SCENARIOS.map((s) => {
                const active = scenarioId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setScenarioId(s.id)}
                    style={{
                      display: 'flex',
                      gap: 12,
                      alignItems: 'flex-start',
                      textAlign: 'right',
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: active ? '2px solid var(--gold)' : '1px solid var(--line)',
                      background: active ? 'color-mix(in srgb, var(--color-accent-100) 70%, #fff)' : '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    <Icon name={s.icon} size={20} color="var(--gold)" />
                    <span style={{ flex: 1 }}>
                      <span style={{ display: 'block', fontWeight: 700, fontSize: 14 }}>{s.title}</span>
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--color-neutral-600)', marginTop: 2, lineHeight: 1.5 }}>{s.hint}</span>
                    </span>
                    {active && <Icon name="check_circle" size={18} color="var(--gold)" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="field">
            <label>4) نص الملاحظة</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {scenario.templates.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: 11, padding: '6px 10px' }}
                  onClick={() => onPickTemplate(t)}
                >
                  + {t.slice(0, 28)}{t.length > 28 ? '…' : ''}
                </button>
              ))}
            </div>
            <textarea
              className="input"
              rows={4}
              placeholder="اكتب ملاحظة قصيرة وواضحة…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              required
              style={{ resize: 'vertical' }}
            />
          </div>

          <div className="field">
            <label>5) من يشاهدها؟</label>
            <div style={{ display: 'grid', gap: 8, marginTop: 6 }}>
              {AUDIENCE_OPTIONS.map((a) => (
                <label
                  key={a.id}
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: audience === a.id ? '2px solid var(--gold)' : '1px solid var(--line)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="audience"
                    checked={audience === a.id}
                    onChange={() => setAudience(a.id)}
                    style={{ marginTop: 3 }}
                  />
                  <span>
                    <span style={{ display: 'block', fontWeight: 600, fontSize: 13 }}>{a.label}</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--color-neutral-600)' }}>{a.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {message && <div style={{ fontSize: 12, color: 'var(--color-accent-700)' }}>{message}</div>}
          <button type="submit" className="btn btn-primary btn-block" disabled={saving || !enrolled.length || !studentId}>
            <Icon name="save" size={15} /> {saving ? 'جارٍ الحفظ…' : 'حفظ الملاحظة'}
          </button>
        </form>

        <section className="card" style={{ gap: 12 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="card-title" style={{ margin: 0 }}>سجل ملاحظات الصف</div>
            <SegmentedTabs
              tabs={LIST_FILTERS.map((f) => ({
                ...f,
                active: listFilter === f.id,
                onClick: () => setListFilter(f.id),
              }))}
            />
          </div>
          <ErrorBanner>{error && 'تعذّر تحميل البيانات.'}</ErrorBanner>

          {list.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>
              لا ملاحظات بعد لهذا الصف{search ? ' مطابقة للبحث' : ''}.
            </div>
          )}

          {list.map((o) => {
            const sc = scenarioForObservation(o);
            const aud = audienceFromFlags(o.visibleToStudent !== false, !!o.visibleToParent);
            const audLabel = AUDIENCE_OPTIONS.find((a) => a.id === aud)?.label || '—';
            return (
              <div
                key={o.id}
                style={{
                  display: 'flex',
                  gap: 12,
                  padding: '12px 0',
                  borderBottom: '1px solid var(--line)',
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    flex: 'none',
                    borderRadius: 12,
                    background: o.sentiment === 'إيجابي'
                      ? 'var(--color-accent-100)'
                      : 'color-mix(in srgb, var(--color-neutral-200) 80%, transparent)',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <Icon name={sc?.icon || 'chat'} size={18} color="var(--gold)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 14 }}>{o.studentName || o.student}</strong>
                    <span className="tag tag-outline" style={{ fontSize: 10 }}>
                      {sc?.title || o.kind}
                    </span>
                    <span
                      className={`tag ${o.sentiment === 'إيجابي' ? 'tag-accent' : 'tag-neutral'}`}
                      style={{ fontSize: 10 }}
                    >
                      {o.sentiment === 'إيجابي' ? 'تشجيع' : o.sentiment === 'محايد' ? 'محايد' : 'متابعة'}
                    </span>
                    <span style={{ marginInlineStart: 'auto', fontSize: 11, color: 'var(--color-neutral-500)' }}>
                      {o.daysAgo != null ? relativeDaysAr(o.daysAgo) : relativeFromTimestamp(o.createdAt)}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', marginTop: 6, lineHeight: 1.6 }}>
                    {o.note}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-neutral-500)', marginTop: 6 }}>
                    الظهور: {audLabel}
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
