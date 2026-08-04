import Icon from './Icon';

export default function Modal({ title, onClose, onSubmit, children, submitLabel = 'حفظ', width = 480, submitting = false, error }) {
  const stop = (e) => e.stopPropagation();
  const close = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    onClose?.();
  };

  return (
    <div className="dialog-backdrop" onClick={close} role="presentation">
      <form
        className="dialog"
        onClick={stop}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit?.(e);
        }}
        style={{ width: `min(${width}px, 100%)` }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div className="dialog-title">{title}</div>
          <button type="button" onClick={close} className="btn btn-icon btn-ghost" style={{ marginInlineStart: 'auto' }} aria-label="إغلاق">
            <Icon name="close" size={18} />
          </button>
        </div>
        {children}
        {error && <div style={{ fontSize: 13, color: 'var(--color-accent-2-700)' }}>{error}</div>}
        <div className="dialog-actions">
          <button type="button" onClick={close} className="btn btn-secondary">إلغاء</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'جارٍ الحفظ…' : submitLabel}</button>
        </div>
      </form>
    </div>
  );
}
