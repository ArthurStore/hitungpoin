import { Fire } from '@phosphor-icons/react';
import { resolveAssetUrl } from '../utils/api';

const RANK_STYLES = {
  1: {
    badge: 'bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-600 text-black',
    row: 'from-amber-500/30 via-orange-600/40 to-red-900/50',
    ring: 'ring-amber-400/40',
  },
  2: {
    badge: 'bg-gradient-to-br from-slate-200 via-slate-300 to-slate-500 text-black',
    row: 'from-slate-400/20 via-slate-600/30 to-slate-900/50',
    ring: 'ring-slate-300/30',
  },
  3: {
    badge: 'bg-gradient-to-br from-amber-600 via-orange-700 to-amber-900 text-white',
    row: 'from-amber-700/25 via-orange-800/35 to-slate-900/50',
    ring: 'ring-amber-700/30',
  },
};

const POSTER_W = 540;
const POSTER_H = 960;

export default function OfficialLeaderboard({ tournament, standings, matches = [], boardRef }) {
  const totalMatches = tournament?.totalMatches || matches.length || 6;
  const matchNumbers = Array.from({ length: totalMatches }, (_, i) => i + 1);
  const subtitle = tournament?.leaderboardSubtitle || 'KLASEMEN GRAND FINAL';
  const logoUrl = resolveAssetUrl(tournament?.logo);

  return (
    <div className="mx-auto overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10" style={{ width: POSTER_W }}>
      <div
        ref={boardRef}
        className="relative flex flex-col text-white"
        style={{
          width: POSTER_W,
          height: POSTER_H,
          background: 'linear-gradient(180deg, #0c1222 0%, #111827 12%, #0f172a 40%, #020617 100%)',
        }}
      >
        <div
          className="absolute inset-x-0 top-0 h-48 opacity-40"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, #f59e0b 0%, transparent 70%)' }}
        />

        <div className="relative z-10 px-5 pb-3 pt-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black/50 ring-2 ring-white/15">
              {logoUrl ? (
                <img src={logoUrl} alt="Organizer" className="h-full w-full object-contain p-1" crossOrigin="anonymous" />
              ) : (
                <span className="text-[8px] font-bold uppercase text-white/40">LOGO</span>
              )}
            </div>

            <div className="min-w-0 flex-1 text-center">
              <h1
                className="font-display text-lg font-black uppercase leading-tight tracking-wide text-white"
                style={{ textShadow: '0 2px 12px rgba(0,0,0,0.8)' }}
              >
                {subtitle}
              </h1>
              <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.25em] text-amber-400/90">
                {tournament?.name}
              </p>
            </div>

            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-black/50 p-1.5 ring-2 ring-orange-500/30">
              <img src="/free-fire-logo.svg" alt="Free Fire" className="h-full w-full object-contain" crossOrigin="anonymous" />
            </div>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
        </div>

        <div className="relative z-10 flex-1 overflow-hidden px-3 pb-4">
          <div
            className="mb-2 grid gap-0.5 px-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-400"
            style={{
              gridTemplateColumns: `22px minmax(0, 88px) repeat(${totalMatches}, minmax(0, 1fr)) 28px`,
            }}
          >
            <span>#</span>
            <span className="truncate">Team</span>
            {matchNumbers.map((n) => <span key={n} className="text-center">M{n}</span>)}
            <span className="text-right">PTS</span>
          </div>

          <div className="space-y-1">
            {standings.length === 0 ? (
              <p className="py-16 text-center text-xs text-white/30">Belum ada data klasemen</p>
            ) : standings.slice(0, 12).map((team) => {
              const rs = RANK_STYLES[team.rank] || {
                badge: 'bg-slate-800 text-white',
                row: 'from-slate-800/50 to-slate-900/80',
                ring: 'ring-white/5',
              };

              return (
                <div
                  key={team.teamId || team.teamName}
                  className={`grid items-center gap-0.5 rounded-md bg-gradient-to-r px-0.5 py-0.5 ring-1 ${rs.row} ${rs.ring}`}
                  style={{
                    gridTemplateColumns: `22px minmax(0, 88px) repeat(${totalMatches}, minmax(0, 1fr)) 28px`,
                  }}
                >
                  <div className={`flex h-5 w-5 items-center justify-center rounded text-[9px] font-black ${rs.badge}`}>
                    {team.rank}
                  </div>
                  <p className="truncate text-[8px] font-bold uppercase leading-tight tracking-wide text-white" title={team.teamName}>
                    {team.rank === 1 && <Fire size={8} weight="fill" className="mr-0.5 inline text-orange-300" />}
                    {team.teamName}
                  </p>
                  {matchNumbers.map((n) => (
                    <span key={n} className="text-center font-mono text-[7px] font-semibold text-slate-300">
                      {team.matchScores?.[n] ?? '-'}
                    </span>
                  ))}
                  <span className="text-right font-mono text-[8px] font-black text-amber-400">
                    {team.totalPoints}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative z-10 border-t border-white/5 px-4 py-3 text-center">
          <p className="font-display text-[9px] font-bold uppercase tracking-[0.35em] text-emerald/70">
            AP · Arthur Points
          </p>
        </div>
      </div>
    </div>
  );
}
