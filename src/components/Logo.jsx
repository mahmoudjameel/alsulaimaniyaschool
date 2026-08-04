import { SCHOOL_NAME_AR, SCHOOL_NAME_EN } from '../lib/constants';

export default function Logo({ size = 40, onDark = false, subtitle, onClick, full = false }) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 11,
        background: 'transparent', border: 0, cursor: onClick ? 'pointer' : 'default',
        padding: onClick ? '6px 8px' : 0, textAlign: 'right', font: 'inherit',
      }}
    >
      <img
        src="/assets/logo-mark.png"
        alt={`شعار ${SCHOOL_NAME_AR}`}
        style={{ width: size, height: size, objectFit: 'contain', flex: 'none' }}
      />
      <div style={{ lineHeight: 1.15 }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: full ? size * 0.5 + 4 : size * 0.42 + 5, fontWeight: 700, color: onDark ? '#fff' : 'var(--ink)' }}>
          {full ? SCHOOL_NAME_AR : 'السليمانية'}
        </div>
        <div style={{ fontSize: full ? 11 : 10, letterSpacing: full ? '.32em' : '.16em', color: onDark ? 'var(--gold)' : (full ? 'var(--gold)' : 'var(--color-neutral-500)') }}>
          {subtitle || SCHOOL_NAME_EN}
        </div>
      </div>
    </Wrapper>
  );
}
