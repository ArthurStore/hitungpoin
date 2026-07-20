import { Fire } from '@phosphor-icons/react';

const RANK_STYLES = {
  1: { badge: 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black', row: 'from-red-600 via-red-700 to-red-800', glow: 'shadow-[0_0_16px_rgba(251,191,36,0.35)]' },
  2: { badge: 'bg-gradient-to-r from-slate-200 to-slate-400 text-black', row: 'from-red-700 via-red-800 to-red-900', glow: '' },
  3: { badge: 'bg-gradient-to-r from-amber-600 to-amber-800 text-white', row: 'from-red-800 via-red-900 to-red-950', glow: '' },
};

function SkewCell({ children, className = '' }) {
  return (
    <div className={`flex h-9 skew-x-[-6deg] items-center justify-center overflow-hidden ${className}`}>
      <span className="skew-x-[6deg]">{children}</span>
    </div>
  );
}

export default function OfficialLeaderboard({ tournament, standings, matches = [], boardRef }) {
  const totalMatches = tournament?.totalMatches || matches.length || 6;
  const matchNumbers = Array.from({ length: totalMatches }, (_, i) => i + 1);

  return (
    <div
      ref={boardRef}
      className="relative overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #fcd34d 0%, #f59e0b 6%, #1e1b4b 22%, #0c0a14 100%)', minHeight: 480 }}
    >
      <div className="px-4 pb-2 pt-5 text-center md:px-8">
        <div className="mb-3 flex items-center justify-between">
          <div className="h-12 w-12 overflow-hidden rounded-lg bg-black/40 ring-1 ring-white/20">
            {tournament?.logo ? <img src={tournament.logo} alt="" className="h-full w-full object-cover" /> : (
              <div className="flex h-full items-center justify-center text-[9px] text-white/50">LOGO</div>
            )}
          </div>
          <p className="text-base font-black italic tracking-[0.2em] text-white md:text-lg">FREE FIRE</p>
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-black/40 text-xs font-bold text-emerald">AP</div>
        </div>
        <h1 className="text-xl font-black uppercase italic tracking-wide text-white md:text-2xl" style={{ textShadow: '2px 2px 6px #000' }}>
          KLASEMEN GRAND FINAL
        </h1>
        <div className="mt-2 inline-block rounded bg-gradient-to-r from-yellow-400 to-orange-500 px-5 py-0.5">
          <span className="text-xs font-bold uppercase text-black">{tournament?.name}</span>
        </div>
      </div>

      <div className="overflow-x-auto px-2 pb-6 md:px-4">
        <div style={{ minWidth: 320 + totalMatches * 44 }}>
          <div className="mb-1.5 grid gap-1 px-1 text-[9px] font-bold uppercase italic tracking-wider text-white/60 md:text-[10px]"
            style={{ gridTemplateColumns: `36px minmax(100px,1fr) repeat(${totalMatches}, 40px) 48px` }}>
            <span>RANK</span>
            <span>NAMA TEAM</span>
            {matchNumbers.map((n) => <span key={n} className="text-center">M{n}</span>)}
            <span className="text-right">TOTAL</span>
          </div>

          {standings.length === 0 ? (
            <p className="py-10 text-center text-sm text-white/40">Belum ada data</p>
          ) : standings.map((team) => {
            const rs = RANK_STYLES[team.rank] || { badge: 'bg-red-950 text-white', row: 'from-red-950 to-black', glow: '' };
            return (
              <div key={team.teamId || team.teamName}
                className={`mb-1 grid gap-1 ${rs.glow}`}
                style={{ gridTemplateColumns: `36px minmax(100px,1fr) repeat(${totalMatches}, 40px) 48px` }}>
                <SkewCell className={rs.badge}>
                  <span className="text-xs font-black">{team.rank}</span>
                </SkewCell>
                <SkewCell className={`justify-start bg-gradient-to-r ${rs.row} px-2`}>
                  <span className="truncate text-[10px] font-bold uppercase italic text-white md:text-xs">
                    {team.rank === 1 && <Fire size={12} weight="fill" className="mr-0.5 inline text-orange-300" />}
                    {team.teamName}
                  </span>
                </SkewCell>
                {matchNumbers.map((n) => (
                  <SkewCell key={n} className="bg-red-950/90">
                    <span className="font-mono text-[10px] font-bold text-white">{team.matchScores?.[n] ?? '-'}</span>
                  </SkewCell>
                ))}
                <SkewCell className="bg-gradient-to-r from-yellow-500 to-orange-500">
                  <span className="font-mono text-xs font-black text-black">{team.totalPoints}</span>
                </SkewCell>
              </div>
            );
          })}
        </div>
      </div>

      <p className="pb-3 text-center text-[9px] uppercase tracking-widest text-white/30">AP (Arthur Points)</p>
    </div>
  );
}
