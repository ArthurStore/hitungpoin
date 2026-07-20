import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Trophy } from '@phosphor-icons/react';
import { api } from '../../utils/api';

export default function LiveStandings() {
  const { tournamentId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPublicStandings(tournamentId)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [tournamentId]);

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald/30 border-t-emerald" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 text-slate-400">
        Tournament not found
      </div>
    );
  }

  const { tournament, standings } = data;

  return (
    <div className="min-h-[100dvh] bg-slate-950 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <div className="mb-2 flex items-center justify-center gap-2">
            <Trophy size={24} className="text-gold" weight="fill" />
            <span className="text-xs font-medium uppercase tracking-wider text-emerald">Live Leaderboard</span>
          </div>
          <h1 className="text-3xl font-bold text-white">{tournament.name}</h1>
          <p className="mt-1 text-sm text-slate-500">{tournament.format} | AP (Arthur Points)</p>
        </div>

        <div className="glass-panel overflow-hidden rounded-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3 text-right">Total Score</th>
              </tr>
            </thead>
            <tbody>
              {standings.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-12 text-center text-slate-500">No standings yet</td></tr>
              ) : standings.map((s) => (
                <tr key={s.teamId || s.teamName} className="border-b border-white/5">
                  <td className="px-4 py-3">
                    <span className={`font-mono font-bold ${s.rank <= 3 ? 'text-gold' : 'text-white'}`}>{s.rank}</span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-white">{s.teamName}</td>
                  <td className="px-4 py-3 text-right font-mono text-lg font-bold text-emerald">{s.totalPoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">Read-only public view. Powered by AP (Arthur Points)</p>
      </div>
    </div>
  );
}
