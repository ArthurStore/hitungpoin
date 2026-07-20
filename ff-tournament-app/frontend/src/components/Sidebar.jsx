import { NavLink } from 'react-router-dom';
import {
  ChartLineUp,
  Trophy,
  PlusCircle,
  Scan,
  Medal,
  Certificate,
} from '@phosphor-icons/react';

const links = [
  { to: '/', icon: ChartLineUp, label: 'Dashboard' },
  { to: '/create', icon: PlusCircle, label: 'Buat Turnamen' },
  { to: '/match', icon: Scan, label: 'Input Match' },
  { to: '/leaderboard', icon: Medal, label: 'Leaderboard' },
  { to: '/certificates', icon: Certificate, label: 'Sertifikat' },
];

export default function Sidebar({ onNavigate }) {
  return (
    <aside className="flex h-full flex-col border-r border-white/5 bg-slate-900/50">
      <div className="hidden p-6 lg:block">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-crimson/20 glow-crimson">
            <Trophy size={22} weight="fill" className="text-crimson" />
          </div>
          <div>
            <p className="font-bold text-white">GridPlay</p>
            <p className="text-xs text-emerald">FF Edition</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all active:scale-[0.98] ${
                isActive
                  ? 'bg-crimson/15 text-crimson glow-crimson'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <Icon size={20} weight="duotone" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/5 p-4">
        <div className="glass-panel rounded-xl p-3">
          <p className="text-xs font-medium text-slate-400">Tesseract.js OCR</p>
          <p className="mt-1 text-[11px] text-slate-500">Proses screenshot lokal di browser</p>
        </div>
      </div>
    </aside>
  );
}
