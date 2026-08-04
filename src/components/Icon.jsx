export default function Icon({ name, size = 16, color, style, className = '' }) {
  return (
    <span
      className={`mi ${className}`}
      style={{ fontSize: size, color, ...style }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
