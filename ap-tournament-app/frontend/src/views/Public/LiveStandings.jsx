import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Trophy } from '@phosphor-icons/react';
import { api, resolveAssetUrl } from '../../utils/api';
import ThemeToggle from '../../components/ThemeToggle';
import { MatchTreeHeaders, matchColumnCount } from '../../components/MatchTreeHeaders';

const MAX_TEAMS = 15;

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

  const { tournament, standings: raw } = data;
  const standings = (raw || []).slice(0, MAX_TEAMS);
  const mode = tournament.inputMode || 'cr_biasa';
  const isLeague = mode === 'cr_league';
  const totalMatches = tournament.totalMatches || 6;
  const matchNumbers = Array.from({ length: totalMatches }, (_, i) => i + 1);
  const matchCols = matchColumnCount(totalMatches, mode);
  const n = Math.max(standings.length, 1);
  const gridCols = `40px minmax(120px,1.4fr) repeat(${matchCols}, minmax(48px,1fr)) 64px`;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--ap-bg)] px-4 py-6">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col">
        <div className="mb-4 shrink-0 text-center">
          <div className="mb-2 flex items-center justify-center gap-2">
            {resolveAssetUrl(tournament.logo || tournament.logoUrl) ? (
              <img
                src={resolveAssetUrl(tournament.logo || tournament.logoUrl)}
                alt=""
                className="h-10 w-10 rounded-lg object-contain"
                crossOrigin="anonymous"
              />
            ) : (
              <Trophy size={24} className="text-gold" weight="fill" />
            )}
            <span className="text-xs font-medium uppercase tracking-wider text-emerald">Live Leaderboard</span>
          </div>
          <h1 className="text-3xl font-bold text-white light:text-slate-900">{tournament.name}</h1>
          <p className="mt-1 text-sm text-slate-500">{tournament.format} | AP (Arthur Points)</p>
        </div>

        <div className="glass-panel flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl p-3">
          <div
            className="mb-2 grid shrink-0 items-end gap-1 border-b border-white/5 pb-2 text-slate-500"
            style={{ gridTemplateColumns: gridCols }}
          >
            <span className="text-xs font-bold">#</span>
            <span className="text-xs font-bold uppercase">Team</span>
            <MatchTreeHeaders matchNumbers={matchNumbers} mode={mode} />
            <span className="text-right text-xs font-bold">TOTAL</span>
          </div>

          {standings.length === 0 ? (
            <p className="py-12 text-center text-slate-500">No standings yet</p>
          ) : (
            <div
              className="grid min-h-0 flex-1 gap-0.5"
              style={{ gridTemplateRows: `repeat(${n}, minmax(0, 1fr))` }}
            >
              {standings.map((s) => (
                <div
                  key={s.teamId || s.teamName}
                  className="grid h-full min-h-0 items-center gap-1 border-b border-white/5"
                  style={{ gridTemplateColumns: gridCols }}
                >
                  <span className={`font-mono font-bold ${s.rank <= 3 ? 'text-gold' : 'text-white light:text-slate-900'}`}>
                    {s.rank <= 3 ? ['🥇', '🥈', '🥉'][s.rank - 1] : s.rank}
                  </span>
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-semibold text-white light:text-slate-900">{s.teamName}</span>
                  </div>
                  {matchNumbers.map((num) => {
                    const bd = s.matchBreakdown?.[num];
                    const total = bd?.totalPoints ?? s.matchScores?.[num];
                    if (isLeague) {
                      return (
                        <span key={num} className="text-center font-mono text-sm font-bold text-cyan-400">
                          {total == null ? '—' : total}
                        </span>
                      );
                    }
                    return (
                      <span key={num} className="col-span-2 grid grid-cols-2 text-center font-mono text-xs">
                        <span className="font-bold text-emerald">{total == null ? '—' : total}</span>
                        <span className="text-slate-400">{bd?.kills ?? '—'}</span>
                      </span>
                    );
                  })}
                  <span className={`text-right font-mono text-lg font-bold ${
                    s.rank === 1 ? 'text-yellow-400' : 'text-emerald'
                  }`}>
                    {s.totalPoints}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="mt-4 shrink-0 text-center text-xs text-slate-600">
          {isLeague ? 'CR League: Total Score per match' : 'CR Biasa: PTS & KILL per match'} · Auto-refresh 15s
        </p>
      </div>
    </div>
  );
}
