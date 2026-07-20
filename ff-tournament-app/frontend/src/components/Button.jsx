const variants = {
  primary: 'bg-crimson text-white hover:bg-red-500 glow-crimson',
  secondary: 'bg-slate-700 text-white hover:bg-slate-600',
  success: 'bg-emerald text-white hover:bg-emerald/90 glow-emerald',
  gold: 'bg-gold text-slate-950 hover:bg-amber-400 glow-gold',
  ghost: 'bg-transparent text-slate-300 hover:bg-white/5 border border-white/10',
  danger: 'bg-red-900/50 text-red-400 hover:bg-red-900/70 border border-red-500/30',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  ...props
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      )}
      {children}
    </button>
  );
}
