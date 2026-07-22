export default function APLogo({ className = '', showText = true, size = 'md' }) {
  const sizes = {
    sm: { icon: 28, text: 'text-sm' },
    md: { icon: 36, text: 'text-base' },
    lg: { icon: 48, text: 'text-xl' },
  };
  const s = sizes[size] || sizes.md;

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg width={s.icon} height={s.icon} viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="apTrophyGrad" x1="0" y1="0" x2="64" y2="64">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="14" fill="#0F172A" />
        <path
          d="M18 22h10v4c0 6.627 5.373 12 12 12s12-5.373 12-12v-4h10v6c0 8.284-5.716 15.239-13.4 17.106L44 52H20l-2.6-6.894C9.716 43.239 4 36.284 4 28V22h14z"
          fill="url(#apTrophyGrad)"
        />
        <rect x="22" y="38" width="4" height="12" rx="1" fill="#F59E0B" />
        <rect x="28" y="34" width="4" height="16" rx="1" fill="#10B981" />
        <rect x="34" y="30" width="4" height="20" rx="1" fill="#06B6D4" />
        <rect x="40" y="36" width="4" height="14" rx="1" fill="#94A3B8" />
      </svg>
      {showText && (
        <div className={`leading-tight ${s.text}`}>
          <span className="block font-display font-bold tracking-wide text-white">AP</span>
          <span className="block text-[10px] font-medium uppercase tracking-widest text-slate-400">Arthur Points</span>
        </div>
      )}
    </div>
  );
}
