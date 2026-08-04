import Icon from './Icon';

/**
 * Compact search field used across student/teacher lists.
 * @param {{ value: string, onChange: (v: string) => void, placeholder?: string, style?: object, autoFocus?: boolean }} props
 */
export default function SearchInput({
  value,
  onChange,
  placeholder = 'بحث بالاسم أو رقم الهوية…',
  style,
  autoFocus = false,
}) {
  return (
    <div
      className="ah-search"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        flex: '1 1 220px',
        minWidth: 180,
        maxWidth: 420,
        ...style,
      }}
    >
      <Icon
        name="search"
        size={16}
        color="var(--color-neutral-400)"
        style={{ position: 'absolute', insetInlineStart: 12, pointerEvents: 'none' }}
      />
      <input
        className="input"
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ paddingInlineStart: 36, paddingInlineEnd: value ? 36 : 12, width: '100%', fontSize: 13 }}
        aria-label={placeholder}
      />
      {value ? (
        <button
          type="button"
          className="btn btn-icon btn-ghost"
          title="مسح"
          aria-label="مسح البحث"
          onClick={() => onChange('')}
          style={{ position: 'absolute', insetInlineEnd: 4, width: 28, height: 28 }}
        >
          <Icon name="close" size={14} />
        </button>
      ) : null}
    </div>
  );
}
