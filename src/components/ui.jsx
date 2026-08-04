import Icon from './Icon';

export function Kpi({ label, value, delta, icon }) {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="card-kicker">{label}</span>
        {icon && <Icon name={icon} size={16} color="var(--gold)" />}
      </div>
      <div className="ah-tabnum" style={{ fontFamily: 'var(--font-heading)', fontSize: 34, lineHeight: 1 }}>{value}</div>
      {delta && <div className="card-meta">{delta}</div>}
    </div>
  );
}

export function SegmentedTabs({ tabs }) {
  return (
    <div className="ah-seg">
      {tabs.map((t) => (
        <button key={t.id} className="ah-segbtn" data-active={t.active} onClick={t.onClick}>{t.label}</button>
      ))}
    </div>
  );
}

export function StatusTag({ tone = 'neutral', children }) {
  const cls = { accent: 'tag-accent', accent2: 'tag-accent-2', neutral: 'tag-neutral', outline: 'tag-outline' }[tone] || 'tag-neutral';
  return <span className={`tag ${cls}`}>{children}</span>;
}

export function EmptyRow({ colSpan, children }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ textAlign: 'center', padding: '28px 12px', color: 'var(--color-neutral-500)', fontSize: 13 }}>
        {children}
      </td>
    </tr>
  );
}

export function Loader({ label = 'يُحمَّل…' }) {
  return (
    <div className="ah-full-loader">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div className="ah-spinner" />
        <div style={{ fontSize: 13, color: 'var(--color-neutral-600)' }}>{label}</div>
      </div>
    </div>
  );
}

export function ErrorBanner({ children }) {
  if (!children) return null;
  return (
    <div className="ah-error-banner">
      <Icon name="error" size={18} />
      <span>{children}</span>
    </div>
  );
}

export function InlineError({ children }) {
  if (!children) return null;
  return <div style={{ fontSize: 12, color: 'var(--color-accent-2-700)', marginTop: -6 }}>{children}</div>;
}

export function Field({ label, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

export function IconButton({ icon, onClick, title, type = 'button' }) {
  return (
    <button type={type} onClick={onClick} title={title} className="btn btn-icon btn-secondary">
      <Icon name={icon} size={16} />
    </button>
  );
}
