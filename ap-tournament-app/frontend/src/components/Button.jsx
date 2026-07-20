const variants = {
  primary: 'bg-crimson text-white hover:bg-red-500',
  success: 'bg-emerald text-white hover:bg-emerald/90',
  gold: 'bg-gold text-slate-950 hover:bg-amber-400',
  ghost: 'border border-white/10 bg-transparent text-slate-300 hover:bg-white/5',
  danger: 'border border-crimson/30 text-crimson hover:bg-crimson/10',
};

export default function Button({ children, variant = 'primary', loading, disabled, className = '', ...props }) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
      {children}
    </button>
  );
}
