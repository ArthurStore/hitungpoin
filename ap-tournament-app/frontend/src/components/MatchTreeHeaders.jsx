/**
 * Tree/branch match column headers.
 * CR Biasa: MATCH n → PTS | KILL (wide branch spanning both columns)
 * CR League: MATCH n → TOTAL
 */
export function matchColumnCount(totalMatches, mode) {
  return mode === 'cr_league' ? totalMatches : totalMatches * 2;
}

export function MatchTreeHeaders({ matchNumbers, mode, compact = false }) {
  const isLeague = mode === 'cr_league';
  const labelCls = compact
    ? 'text-[7px] font-bold uppercase tracking-wide text-slate-400'
    : 'text-[9px] font-bold uppercase tracking-wider text-cyan-200/75';
  const titleCls = compact
    ? 'text-[8px] font-black uppercase tracking-wide text-amber-300/95'
    : 'text-[10px] font-black uppercase tracking-wide text-cyan-200';

  if (isLeague) {
    return matchNumbers.map((n) => (
      <div
        key={n}
        className="flex flex-col items-center justify-end border-r border-white/10 px-0.5 pb-0.5 last:border-r-0"
      >
        <span className={titleCls}>MATCH {n}</span>
        <div className="mt-0.5 h-px w-full bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />
        <span className={`${labelCls} mt-0.5 text-emerald-300/90`}>TOTAL</span>
      </div>
    ));
  }

  return matchNumbers.map((n) => (
    <div
      key={n}
      className="col-span-2 flex w-full flex-col items-center border-r border-white/15 px-0.5 pb-0.5 last:border-r-0"
    >
      <span className={titleCls}>MATCH {n}</span>
      <svg viewBox="0 0 100 12" className="mt-0.5 h-3 w-full" preserveAspectRatio="none" aria-hidden>
        <path
          d="M50 0 V5 M50 5 H12 M50 5 H88 M12 5 V11 M88 5 V11"
          fill="none"
          stroke="rgba(251,191,36,0.7)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="grid w-full grid-cols-2 gap-0.5 text-center">
        <span className={`${labelCls} text-emerald-300/90`}>PTS</span>
        <span className={`${labelCls} text-cyan-300/90`}>KILL</span>
      </div>
    </div>
  ));
}

export function MatchScoreCells({
  team,
  matchNumbers,
  mode,
  editable = false,
  onEdit,
  compact = false,
}) {
  const isLeague = mode === 'cr_league';
  const ptsCls = compact
    ? 'text-center font-mono text-[11px] font-bold text-emerald-300'
    : 'text-center font-mono text-sm font-bold text-emerald-300';
  const killCls = compact
    ? 'text-center font-mono text-[10px] font-semibold text-cyan-200/90'
    : 'text-center font-mono text-sm text-cyan-200';

  return matchNumbers.map((n) => {
    const bd = team.matchBreakdown?.[n];
    const total = bd?.totalPoints ?? team.matchScores?.[n];

    if (isLeague) {
      const cell = (
        <span className={ptsCls}>{total == null ? '-' : total}</span>
      );
      return editable ? (
        <button
          key={n}
          type="button"
          onClick={() => onEdit?.(team, n)}
          className="rounded border-r border-white/10 hover:bg-white/10 last:border-r-0"
          title={`Edit Match ${n}`}
        >
          {cell}
        </button>
      ) : (
        <span key={n} className="border-r border-white/10 last:border-r-0">{cell}</span>
      );
    }

    const pts = total;
    const kills = bd?.kills;
    const cell = (
      <>
        <span className={ptsCls}>{pts == null ? '-' : pts}</span>
        <span className={killCls}>{kills == null ? '-' : kills}</span>
      </>
    );

    return editable ? (
      <button
        key={n}
        type="button"
        onClick={() => onEdit?.(team, n)}
        className="col-span-2 grid grid-cols-2 rounded border-r border-white/15 hover:bg-white/10 last:border-r-0"
        title={`Edit Match ${n}`}
      >
        {cell}
      </button>
    ) : (
      <span key={n} className="col-span-2 grid grid-cols-2 border-r border-white/15 last:border-r-0">
        {cell}
      </span>
    );
  });
}
