/** Compact child picker for multi-child parent screens. */
export default function ChildSwitcher({ children, selectedId, onChange }) {
  if (!children?.length || children.length <= 1) return null;
  return (
    <div className="stu-actions-row" role="tablist" aria-label="اختيار الابن">
      {children.map((c) => {
        const active = c.id === selectedId;
        return (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`btn ${active ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: 13 }}
            onClick={() => onChange(c.id)}
          >
            {c.name}
          </button>
        );
      })}
    </div>
  );
}
