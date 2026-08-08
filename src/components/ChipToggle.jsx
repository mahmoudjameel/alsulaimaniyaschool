/** Toggle chip used in class schedule forms. */
export default function ChipToggle({ selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn"
      style={{
        fontSize: 12,
        padding: '6px 10px',
        borderRadius: 8,
        border: selected ? '1px solid var(--gold)' : '1px solid var(--line)',
        background: selected ? 'var(--color-accent-100)' : 'transparent',
        color: selected ? 'var(--color-accent-900)' : 'var(--color-neutral-700)',
        fontWeight: selected ? 600 : 400,
      }}
    >
      {children}
    </button>
  );
}
