import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { api, resolveAssetUrl, API_BASE } from '../../utils/api';

function socketOrigin() {
  return API_BASE.replace(/\/api\/?$/, '');
}

function slugify(name = '') {
  return String(name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function MatchCell({ team, n, mode }) {
  const bd = team.matchBreakdown?.[n];
  const total = bd?.totalPoints ?? team.matchScores?.[n];
  if (total == null && !bd) return <span className="text-white/30">-</span>;
  if (mode === 'cr_league') {
    return <span className="font-mono text-cyan-300">{total}</span>;
  }
  return (
    <span className="flex flex-col leading-none">
      <span className="font-mono text-[11px] text-emerald-300">{bd?.placementPoints ?? 0}</span>
      <span className="font-mono text-[9px] text-white/50">{bd?.killPoints ?? 0}k</span>
    </span>
  );
}

export default function ObsOverlay() {
  const { tournamentSlug } = useParams();
  const [payload, setPayload] = useState(null);
  const [tick, setTick] = useState(0);
  const [connected, setConnected] = useState(false);
  const tournamentIdRef = useRef(null);

  useEffect(() => {
    let alive = true;
    const socket = io(socketOrigin(), { transports: ['websocket', 'polling'] });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    const load = () => api.getPublicStandings(tournamentSlug).then((d) => {
      if (!alive) return;
      setPayload(d);
      const tid = d.tournament?._id;
      if (tid) {
        tournamentIdRef.current = tid;
        socket.emit('join-tournament', tid);
      }
    }).catch(console.error);

    load();

    socket.on('leaderboard:update', (data) => {
      if (!alive) return;
      const tid = tournamentIdRef.current;
      const matchId = tid && String(data?.tournament?._id) === String(tid);
      const matchSlug = slugify(data?.tournament?.name) === String(tournamentSlug).toLowerCase();
      const matchParam = String(data?.tournament?._id) === String(tournamentSlug);
      if (matchId || matchSlug || matchParam) {
        setPayload((prev) => ({
          ...prev,
          tournament: { ...(prev?.tournament || {}), ...(data.tournament || {}) },
          standings: data.standings || [],
          matches: data.matches || prev?.matches,
        }));
        setTick((t) => t + 1);
      }
    });

    const poll = setInterval(load, 20000);
    const anim = setInterval(() => setTick((t) => t + 1), 12000);

    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(anim);
      socket.disconnect();
    };
  }, [tournamentSlug]);

  const tournament = payload?.tournament;
  const standings = useMemo(() => (payload?.standings || []).slice(0, 15), [payload]);
  const mode = tournament?.inputMode || 'cr_biasa';
  const totalMatches = tournament?.totalMatches || 6;
  const matchNumbers = Array.from({ length: totalMatches }, (_, i) => i + 1);

  if (!tournament) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-transparent text-white/70">
        Loading overlay…
      </div>
    );
  }

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden bg-transparent text-white">
      <div className="pointer-events-none absolute inset-0">
        <div
          className="overlay-glow absolute -left-20 top-10 h-64 w-64 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, #22d3ee55, transparent 70%)' }}
        />
        <div
          className="overlay-glow absolute -right-16 bottom-20 h-72 w-72 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, #e879f955, transparent 70%)', animationDelay: '1.2s' }}
        />
        <div className="overlay-scanline absolute inset-x-0 h-24 bg-gradient-to-b from-cyan-400/20 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-[720px] flex-col px-4 py-6">
        <header className="mb-4 flex items-center justify-between gap-3 border-b border-cyan-400/30 pb-3">
          <div className="flex items-center gap-3">
            {tournament.logo && (
              <img
                src={resolveAssetUrl(tournament.logo)}
                alt=""
                className="h-12 w-12 object-contain"
                style={{ background: 'transparent' }}
              />
            )}
            <div>
              <p className="font-display text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">
                Live Overlay · OBS
              </p>
              <h1 className="font-display text-2xl font-black uppercase tracking-wide text-white drop-shadow-[0_0_12px_#22d3ee]">
                {tournament.leaderboardSubtitle || tournament.name}
              </h1>
            </div>
          </div>
          <div className="text-right">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${connected ? 'bg-emerald/20 text-emerald' : 'bg-white/10 text-white/50'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald' : 'bg-white/40'}`} />
              {connected ? 'LIVE' : 'POLL'}
            </span>
            <p className="mt-1 text-[10px] uppercase tracking-widest text-fuchsia-300/80">{tournament.name}</p>
          </div>
        </header>

        <div
          className="mb-2 grid gap-1 text-[10px] font-bold uppercase tracking-wider text-cyan-200/70"
          style={{ gridTemplateColumns: `28px 32px minmax(0,1.4fr) repeat(${totalMatches}, minmax(0,1fr)) 44px` }}
        >
          <span>#</span>
          <span />
          <span>Team</span>
          {matchNumbers.map((n) => <span key={n} className="text-center">M{n}</span>)}
          <span className="text-right">PTS</span>
        </div>

        <div className="flex flex-1 flex-col gap-1.5">
          {standings.map((team, idx) => (
            <div
              key={`${team.teamId || team.teamName}-${tick}`}
              className="overlay-row-enter grid items-center gap-1 rounded-lg border border-cyan-400/20 bg-black/55 px-2 py-2 backdrop-blur-md"
              style={{
                gridTemplateColumns: `28px 32px minmax(0,1.4fr) repeat(${totalMatches}, minmax(0,1fr)) 44px`,
                animationDelay: `${idx * 0.12}s`,
                boxShadow: team.rank <= 3 ? '0 0 18px rgba(34,211,238,0.25)' : 'none',
              }}
            >
              <span className={`font-display text-sm font-black ${team.rank <= 3 ? 'text-amber-300' : 'text-white/80'}`}>
                {team.rank}
              </span>
              {team.logo ? (
                <img src={resolveAssetUrl(team.logo)} alt="" className="h-7 w-7 object-contain" style={{ background: 'transparent' }} />
              ) : (
                <span className="text-center text-[10px] text-white/30">{(team.teamName || '?')[0]}</span>
              )}
              <p className="truncate font-display text-sm font-bold uppercase tracking-wide text-white">
                {team.teamName}
              </p>
              {matchNumbers.map((n) => (
                <span key={n} className="text-center">
                  <MatchCell team={team} n={n} mode={mode} />
                </span>
              ))}
              <span className="text-right font-mono text-base font-black text-amber-300 drop-shadow-[0_0_8px_#f59e0b]">
                {team.totalPoints}
              </span>
            </div>
          ))}
        </div>

        <footer className="mt-4 text-center font-display text-[10px] uppercase tracking-[0.4em] text-fuchsia-300/70">
          Free Fire · AP Arthur Points
        </footer>
      </div>
    </div>
  );
}
