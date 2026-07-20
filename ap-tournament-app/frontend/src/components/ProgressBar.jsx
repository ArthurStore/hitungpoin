export default function ProgressBar({ value = 0, className = '' }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className={`h-2.5 w-full overflow-hidden rounded-full bg-slate-800 ${className}`}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-emerald to-emerald/70 transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
