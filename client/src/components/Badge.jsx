const STYLES = {
  active: { color: 'var(--steel)', label: 'Active' },
  abandoned: { color: 'var(--clay)', label: 'Abandoned' },
  recovered: { color: 'var(--moss)', label: 'Recovered' },
  completed: { color: 'var(--moss)', label: 'Completed' },
  low: { color: 'var(--amber)', label: 'Low stock' },
  critical: { color: 'var(--clay)', label: 'Critical' },
  resolved: { color: 'var(--moss)', label: 'Resolved' },
};

export default function Badge({ status, children }) {
  const style = STYLES[status] || { color: 'var(--steel)', label: status };
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[12px] font-medium px-2 py-0.5 rounded"
      style={{ color: style.color, background: `${style.color}1a` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: style.color }} />
      {children || style.label}
    </span>
  );
}
