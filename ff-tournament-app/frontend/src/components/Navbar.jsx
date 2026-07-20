import { List, X } from '@phosphor-icons/react';

export default function Navbar({ onMenuToggle }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuToggle}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white lg:hidden"
            aria-label="Toggle menu"
          >
            <List size={22} weight="bold" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-crimson/20">
              <span className="text-sm font-bold text-crimson">GP</span>
            </div>
            <div>
              <p className="text-sm font-bold leading-none text-white">GridPlay</p>
              <p className="text-[10px] font-medium text-emerald">FF Edition</p>
            </div>
          </div>
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          <span className="rounded-full bg-emerald/10 px-3 py-1 text-xs font-medium text-emerald">
            OCR Lokal Aktif
          </span>
        </div>
      </div>
    </header>
  );
}

export function MobileSidebarOverlay({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute left-0 top-0 h-full w-72 bg-slate-900 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-4 rounded-lg p-2 text-slate-400 hover:text-white"
          aria-label="Close menu"
        >
          <X size={20} />
        </button>
        {children}
      </div>
    </div>
  );
}
