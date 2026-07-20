import { useEffect, useState } from 'react';
import { useParams, useNavigate, NavLink, Outlet } from 'react-router-dom';
import { ArrowLeft, LinkSimple } from '@phosphor-icons/react';
import { api } from '../../utils/api';
import Button from '../../components/Button';

const TABS = [
  { to: 'setup', label: 'Setup' },
  { to: 'teams', label: 'Teams' },
  { to: 'match', label: 'Input Match' },
  { to: 'leaderboard', label: 'Leaderboard' },
  { to: 'certificates', label: 'Certificate' },
];

export default function TournamentHub() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = () => api.getTournament(id).then(setTournament);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald/30 border-t-emerald" /></div>;
  }

  if (!tournament) return <p className="text-slate-400">Tournament not found</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate('/')}><ArrowLeft size={16} /></Button>
          <div>
            <h1 className="text-xl font-bold text-white">{tournament.name}</h1>
            <p className="text-xs text-slate-500">{tournament.format} | Tournament Hub</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => window.open(`/live/${id}`, '_blank')}>
          <LinkSimple size={16} /> Public Live Link
        </Button>
      </div>

      <nav className="flex gap-1 overflow-x-auto rounded-xl bg-slate-900/50 p-1">
        {TABS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={`/tournament/${id}/${to}`}
            className={({ isActive }) =>
              `whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
                isActive ? 'bg-emerald/15 text-emerald' : 'text-slate-400 hover:text-white'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <Outlet context={{ tournament, refresh }} />
    </div>
  );
}
