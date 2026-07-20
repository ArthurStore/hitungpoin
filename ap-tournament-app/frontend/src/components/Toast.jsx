import { useEffect } from 'react';
import { X, CheckCircle, WarningCircle } from '@phosphor-icons/react';

const styles = {
  success: 'border-emerald/30 bg-emerald/10 text-emerald',
  error: 'border-crimson/30 bg-crimson/10 text-crimson',
  info: 'border-gold/30 bg-gold/10 text-gold',
};

export default function Toast({ message, type = 'info', onClose, duration = 5000 }) {
  useEffect(() => {
    if (!message || !onClose) return;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [message, onClose, duration]);

  if (!message) return null;

  const Icon = type === 'success' ? CheckCircle : type === 'error' ? WarningCircle : CheckCircle;

  return (
    <div className="fixed bottom-6 right-6 z-[100] max-w-sm animate-[slideUp_0.3s_ease]">
      <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-2xl ${styles[type]}`}>
        <Icon size={20} weight="fill" className="mt-0.5 shrink-0" />
        <p className="flex-1 text-sm font-medium">{message}</p>
        <button type="button" onClick={onClose} className="shrink-0 opacity-70 hover:opacity-100">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
