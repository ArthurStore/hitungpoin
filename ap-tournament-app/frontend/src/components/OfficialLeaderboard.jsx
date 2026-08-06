import { Fire } from '@phosphor-icons/react';
import { resolveAssetUrl } from '../utils/api';
import { MatchTreeHeaders, MatchScoreCells, matchColumnCount } from './MatchTreeHeaders';

const RANK_STYLES = {
  1: {
    badge: 'bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-600 text-black',
    row: 'from-amber-500/30 via-orange-600/40 to-red-900/50',
  },
  2: {
    badge: 'bg-gradient-to-br from-slate-200 via-slate-300 to-slate-500 text-black',
    row: 'from-slate-400/20 via-slate-600/30 to-slate-900/50',
  },
  3: {
    badge: 'bg-gradient-to-br from-amber-600 via-orange-700 to-amber-900 text-white',
    row: 'from-amber-700/25 via-orange-800/35 to-slate-900/50',
  },
};

const POSTER_W = 540;
const POSTER_H = 960;
const MAX_TEAMS = 15;

function TeamLogo({ logo, name }) {
  const url = resolveAssetUrl(logo);
  if (!url) {
    return (
      <div className="flex h-7 w-7 shrink-0 items-center justify-center text-[10px] font-bold text-white/40">
        {(name || '?').slice(0, 1)}
      </div>
    );
  }
  return (
    <img
      src={url}
      alt=""
      className="h-7 w-7 shrink-0 object-contain"
      style={{ background: 'transparent', border: 'none', boxShadow: 'none', outline: 'none' }}
      crossOrigin="anonymous"
    />
  );
}

export default function OfficialLeaderboard({
  tournament,
  standings,
  matches = [],
  boardRef,
  editable = false,
  onEditMatchScore,
}) {
  const totalMatches = tournament?.totalMatches || matches.length || 6;
  const matchNumbers = Array.from({ length: totalMatches }, (_, i) => i + 1);
  const subtitle = tournament?.leaderboardSubtitle || 'KLASEMEN GRAND FINAL';
  const logoUrl = resolveAssetUrl(tournament?.logo);
  const mode = tournament?.inputMode || 'cr_biasa';
  const rows = standings.slice(0, MAX_TEAMS);
  const rowH = Math.floor(680 / Math.max(rows.length || 15, 15));
  const matchCols = matchColumnCount(totalMatches, mode);
  const isLeague = mode === 'cr_league';

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
          className="absolute inset-x-0 top-0 h-40 opacity-40"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, #f59e0b 0%, transparent 70%)' }}
        />

        <div className="relative z-10 px-4 pb-2 pt-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Organizer"
                  className="h-full w-full object-contain"
                  crossOrigin="anonymous"
                  style={{ background: 'transparent', border: 'none' }}
                />
              ) : (
                <span className="text-[9px] font-bold uppercase text-white/40">LOGO</span>
              )}
            </div>

            <div className="min-w-0 flex-1 text-center">
              <h1
                className="font-display text-2xl font-black uppercase leading-tight tracking-wide text-white"
                style={{ textShadow: '0 2px 12px rgba(0,0,0,0.8)' }}
              >
                {subtitle}
              </h1>
              <p className="mt-0.5 truncate text-xs font-semibold uppercase tracking-[0.2em] text-amber-400/90">
                {tournament?.name}
              </p>
            </div>

            <div className="flex h-14 w-20 shrink-0 items-center justify-center">
              <img
                src="/free-fire-logo.png"
                alt="Free Fire"
                className="h-full w-full object-contain"
                crossOrigin="anonymous"
                style={{ background: 'transparent', border: 'none' }}
              />
            </div>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
          <p className="mt-1 text-center text-[9px] uppercase tracking-widest text-slate-500">
            {isLeague ? 'CR League · Total Score per Match' : 'CR Biasa · PTS & KILL per Match'}
          </p>
        </div>

        <div className="relative z-10 flex-1 overflow-hidden px-2 pb-2">
          <div
            className="mb-1 grid items-end gap-x-0.5 px-0.5"
            style={{
              gridTemplateColumns: `22px 30px minmax(0, 1.15fr) repeat(${matchCols}, minmax(0, 1fr)) 40px`,
            }}
          >
            <span className="pb-1 text-[8px] font-bold text-slate-500">#</span>
            <span />
            <span className="truncate pb-1 text-[8px] font-bold uppercase text-slate-500">Team</span>
            <MatchTreeHeaders matchNumbers={matchNumbers} mode={mode} compact />
            <span className="pb-1 text-right text-[8px] font-bold text-slate-500">TOTAL</span>
          </div>

          <div className="flex flex-col" style={{ gap: 2 }}>
            {rows.length === 0 ? (
              <p className="py-16 text-center text-sm text-white/30">Belum ada data klasemen</p>
            ) : rows.map((team) => {
              const rs = RANK_STYLES[team.rank] || {
                badge: 'bg-slate-800 text-white',
                row: 'from-slate-800/60 to-slate-900/80',
              };

              return (
                <div
                  key={team.teamId || team.teamName}
                  className={`grid items-center gap-x-0.5 rounded-sm bg-gradient-to-r px-0.5 ${rs.row}`}
                  style={{
                    gridTemplateColumns: `22px 30px minmax(0, 1.15fr) repeat(${matchCols}, minmax(0, 1fr)) 40px`,
                    minHeight: Math.max(32, Math.min(46, rowH)),
                    height: Math.max(32, Math.min(46, rowH)),
                  }}
                >
                  <div className={`flex h-6 w-6 items-center justify-center rounded text-[11px] font-black ${rs.badge}`}>
                    {team.rank}
                  </div>
                  <TeamLogo logo={team.logo} name={team.teamName} />
                  <p className="truncate text-[12px] font-bold uppercase leading-tight tracking-wide text-white" title={team.teamName}>
                    {team.rank === 1 && <Fire size={11} weight="fill" className="mr-0.5 inline text-orange-300" />}
                    {team.teamName}
                  </p>
                  <MatchScoreCells
                    team={team}
                    matchNumbers={matchNumbers}
                    mode={mode}
                    editable={editable}
                    onEdit={onEditMatchScore}
                    compact
                  />
                  <span className="text-right font-mono text-[14px] font-black text-amber-400">
                    {team.totalPoints}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative z-10 border-t border-white/5 px-4 py-2 text-center">
          <p className="font-display text-[11px] font-bold uppercase tracking-[0.35em] text-emerald/70">
            AP · Arthur Points
          </p>
        </div>
      </div>
    </div>
  );
}
