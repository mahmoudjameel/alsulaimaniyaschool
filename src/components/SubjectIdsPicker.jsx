import ChipToggle from './ChipToggle';

/** Multi-select teaching subjects as toggle chips. */
export default function SubjectIdsPicker({ subjects, selectedIds, onChange }) {
  const selected = new Set(selectedIds || []);

  const toggle = (id) => {
    if (selected.has(id)) onChange(selectedIds.filter((x) => x !== id));
    else onChange([...(selectedIds || []), id]);
  };

  if (!subjects?.length) {
    return (
      <div style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>
        لا مواد بعد — أضفها من «مواد التدريس».
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {subjects.map((s) => (
        <ChipToggle
          key={s.id}
          selected={selected.has(s.id)}
          onClick={() => toggle(s.id)}
        >
          {s.labelAr}
        </ChipToggle>
      ))}
    </div>
  );
}
