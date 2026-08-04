import { orderBy } from 'firebase/firestore';
import { useLiveOrDemo } from '../../hooks/useFirestore';
import { demoTeacherProfiles } from '../../data/demo';

export default function PublicTeachers() {
  const { data: teachers } = useLiveOrDemo('teacherProfiles', [orderBy('name', 'asc')], demoTeacherProfiles);

  return (
    <div className="site-container">
      <header className="site-page-head">
        <div className="site-section-kicker">هيئة التدريس</div>
        <h1>المعلّمون</h1>
        <p className="site-section-lead">
          هيئة التدريس في المدرسة.
        </p>
      </header>
      <div className="site-grid-4" style={{ paddingBottom: 56 }}>
        {teachers.map((t, i) => (
          <div key={t.id || i} className="site-card-soft" style={{ alignItems: 'center', textAlign: 'center', padding: '8px 4px 16px' }}>
            <div style={{
              width: 88, height: 88, margin: '4px auto', borderRadius: '50%',
              background: 'var(--color-accent-100)', color: 'var(--color-accent-800)',
              display: 'grid', placeItems: 'center', fontFamily: 'var(--font-heading)', fontSize: 34,
              border: '1px solid var(--line)',
            }}
            >
              {t.initial}
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 17, fontWeight: 700 }}>{t.name}</div>
            <div style={{ fontSize: 12, color: 'var(--gold)' }}>{t.subject || t.spec}</div>
            <div style={{ fontSize: 12, color: 'var(--color-neutral-600)', lineHeight: 1.7 }}>{t.bio}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
