export default function Skeleton({ className = '' }) {
  return (
    <div
      className={`animate-pulse rounded ${className}`}
      style={{ background: 'var(--panel-2)' }}
    />
  );
}
