import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Trophy } from '@phosphor-icons/react';
import { api, resolveAssetUrl } from '../../utils/api';
import ThemeToggle from '../../components/ThemeToggle';

export default function LiveStandings() {
  const { tournamentId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => api.getPublicStandings(tournamentId)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [tournamentId]);

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--ap-bg)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald/30 border-t-emerald" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--ap-bg)] text-slate-400">
        Tournament not found
      </div>
    );
  }

  const { tournament, standings } = data;
  const mode = tournament.inputMode || 'cr_biasa';
  const totalMatches = tournament.totalMatches || 6;
  const matchNumbers = Array.from({ length: totalMatches }, (_, i) => i + 1);

  return (
    <div className="min-h-[100dvh] bg-[var(--ap-bg)] px-4 py-8">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <div className="mb-2 flex items-center justify-center gap-2">
            <Trophy size={24} className="text-gold" weight="fill" />
            <span className="text-xs font-medium uppercase tracking-wider text-emerald">Live Leaderboard</span>
          </div>
          {tournament.logo && (
            <img src={resolveAssetUrl(tournament.logo)} alt="" className="mx-auto mb-3 h-14 w-14 object-contain" style={{ background: 'transparent' }} />
          )}
          <h1 className="text-3xl font-bold text-white light:text-slate-900">{tournament.name}</h1>
          <p className="mt-1 text-sm text-slate-500">{tournament.format} | AP (Arthur Points)</p>
          <a href={`/overlay/${tournament._id}`} className="mt-2 inline-block text-xs text-cyan-400 hover:underline">
            Buka OBS Overlay →
          </a>
        </div>

        <div className="glass-panel overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-xs uppercase text-slate-500">
                <th className="px-3 py-3">#</th>
                <th className="px-3 py-3">Team</th>
                {matchNumbers.map((n) => (
                  <th key={n} className="px-2 py-3 text-center">M{n}</th>
                ))}
                <th className="px-3 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {standings.length === 0 ? (
                <tr><td colSpan={3 + totalMatches} className="px-4 py-12 text-center text-slate-500">No standings yet</td></tr>
              ) : standings.map((s) => (
                <tr key={s.teamId || s.teamName} className="border-b border-white/5">
                  <td className="px-3 py-3">
                    <span className={`font-mono font-bold ${s.rank <= 3 ? 'text-gold' : 'text-white light:text-slate-900'}`}>{s.rank}</span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      {s.logo ? (
                        <img src={resolveAssetUrl(s.logo)} alt="" className="h-7 w-7 object-contain" style={{ background: 'transparent' }} />
                      ) : null}
                      <span className="font-semibold text-white light:text-slate-900">{s.teamName}</span>
                    </div>
                  </td>
                  {matchNumbers.map((n) => {
                    const bd = s.matchBreakdown?.[n];
                    const total = bd?.totalPoints ?? s.matchScores?.[n];
                    return (
                      <td key={n} className="px-2 py-3 text-center font-mono text-xs">
                        {total == null ? '—' : mode === 'cr_league' ? (
                          <span className="text-cyan-400">{total}</span>
                        ) : (
                          <span className="text-slate-300">
                            <span className="text-emerald">{bd?.placementPoints ?? 0}</span>
                            <span className="text-slate-500">|</span>
                            <span>{bd?.killPoints ?? 0}</span>
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-3 text-right font-mono text-lg font-bold text-emerald">{s.totalPoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          {mode === 'cr_league' ? 'CR League: Total Score per match' : 'CR Biasa: Place Pts | Kill Pts'} · Auto-refresh 15s
        </p>
      </div>
    </div>
  );
}
