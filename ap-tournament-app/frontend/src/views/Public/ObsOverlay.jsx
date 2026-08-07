import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { api, API_BASE } from '../../utils/api';
import { MatchTreeHeaders, MatchScoreCells, matchColumnCount } from '../../components/MatchTreeHeaders';

function socketOrigin() {
  return API_BASE.replace(/\/api\/?$/, '');
}

function slugify(name = '') {
  return String(name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const MAX_OVERLAY_TEAMS = 15;

export default function ObsOverlay() {
  const { tournamentSlug } = useParams();
  const [payload, setPayload] = useState(null);
  const [tick, setTick] = useState(0);
  const [connected, setConnected] = useState(false);
  const [enterFrom, setEnterFrom] = useState('left');
  const tournamentIdRef = useRef(null);

  useEffect(() => {
    document.documentElement.classList.add('obs-overlay-page');
    document.body.classList.add('obs-overlay-page');
    return () => {
      document.documentElement.classList.remove('obs-overlay-page');
      document.body.classList.remove('obs-overlay-page');
    };
  }, []);

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
        setEnterFrom((f) => (f === 'left' ? 'right' : 'left'));
        setTick((t) => t + 1);
      }
    });

    const poll = setInterval(load, 20000);
    // Slower dramatic cycle
    const anim = setInterval(() => {
      setEnterFrom((f) => (f === 'left' ? 'right' : 'left'));
      setTick((t) => t + 1);
    }, 18000);

    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(anim);
      socket.disconnect();
    };
  }, [tournamentSlug]);

  const tournament = payload?.tournament;
  const standings = useMemo(
    () => (payload?.standings || []).slice(0, MAX_OVERLAY_TEAMS),
    [payload]
  );
  const mode = tournament?.inputMode || 'cr_biasa';
  const totalMatches = tournament?.totalMatches || 6;
  const matchNumbers = Array.from({ length: totalMatches }, (_, i) => i + 1);
  const matchCols = matchColumnCount(totalMatches, mode);
  const n = Math.max(standings.length, 1);
  const gridCols = `36px minmax(0,1.45fr) repeat(${matchCols}, minmax(0,1fr)) 56px`;

  if (!tournament) {
    return (
      <div className="flex h-screen w-screen items-center justify-center overflow-hidden text-cyan-200/80"
        style={{ background: 'linear-gradient(160deg, #020617 0%, #0c1a3a 45%, #0a1628 100%)' }}
      >
        Loading overlay…
      </div>
    );
  }

  return (
    <div
      className="obs-overlay-root relative flex h-screen w-screen max-h-screen flex-col overflow-hidden p-1.5 text-white sm:p-2"
      style={{
        background: 'linear-gradient(165deg, #020617 0%, #071428 28%, #0b1f3f 55%, #06101f 100%)',
      }}
    >
      {/* Neon atmosphere */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="overlay-glow absolute -left-24 top-0 h-72 w-72 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.28), transparent 70%)' }}
        />
        <div
          className="overlay-glow absolute -right-16 bottom-0 h-80 w-80 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.22), transparent 70%)', animationDelay: '1.2s' }}
        />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: 'linear-gradient(rgba(34,211,238,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.04) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className="overlay-scanline absolute inset-x-0 h-24 bg-gradient-to-b from-cyan-400/10 to-transparent" />
      </div>

      <div className="relative z-10 flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg border border-cyan-400/25 bg-slate-950/35 px-2 py-1.5 shadow-[0_0_40px_rgba(34,211,238,0.12)] backdrop-blur-[2px] sm:px-3 sm:py-2">
        <header className="flex w-full shrink-0 items-center justify-between border-b border-cyan-400/35 pb-1.5">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-black uppercase leading-none tracking-[0.18em] text-white drop-shadow-[0_0_16px_#22d3ee] sm:text-3xl md:text-4xl">
              LIVE SCORE
            </h1>
            <p className="mt-1 truncate text-[11px] uppercase tracking-[0.28em] text-cyan-300/90 sm:text-xs">
              {tournament.name}
            </p>
          </div>
          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${
            connected ? 'bg-emerald/25 text-emerald shadow-[0_0_12px_rgba(16,185,129,0.35)]' : 'bg-white/10 text-white/50'
          }`}>
            <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald animate-pulse' : 'bg-white/40'}`} />
            {connected ? 'LIVE' : 'POLL'}
          </span>
        </header>

        <div
          className="mt-1.5 grid w-full shrink-0 items-end gap-0"
          style={{ gridTemplateColumns: gridCols }}
        >
          <span className="pb-0.5 text-[10px] font-bold text-cyan-200/70">#</span>
          <span className="pb-0.5 text-[10px] font-bold uppercase text-cyan-200/70">Team</span>
          <MatchTreeHeaders matchNumbers={matchNumbers} mode={mode} />
          <span className="pb-0.5 text-right text-[10px] font-bold text-cyan-200/70">TOTAL</span>
        </div>

        <div
          className="mt-1 grid min-h-0 w-full flex-1 gap-1 overflow-hidden"
          style={{ gridTemplateRows: `repeat(${n}, minmax(0, 1fr))` }}
        >
          {standings.map((team, idx) => {
            const animName = enterFrom === 'left' ? 'overlaySlideLeft' : 'overlaySlideRight';
            return (
              <div
                key={`${team.teamId || team.teamName}-${tick}`}
                className="grid h-full min-h-0 w-full items-center gap-0.5 rounded-md border border-cyan-400/30 bg-gradient-to-r from-slate-950/80 via-blue-950/55 to-slate-950/70 px-1.5"
                style={{
                  gridTemplateColumns: gridCols,
                  animation: `${animName} 1.15s cubic-bezier(0.22, 1, 0.36, 1) both`,
                  animationDelay: `${idx * 0.09}s`,
                  boxShadow: team.rank <= 3
                    ? '0 0 18px rgba(34,211,238,0.28), inset 0 0 20px rgba(34,211,238,0.06)'
                    : 'inset 0 0 12px rgba(15,23,42,0.5)',
                }}
              >
                <span className={`font-display text-lg font-black leading-none sm:text-xl ${
                  team.rank <= 3 ? 'text-amber-300 drop-shadow-[0_0_8px_#f59e0b]' : 'text-white/90'
                }`}>
                  {team.rank}
                </span>
                <p className="truncate font-display text-base font-bold uppercase leading-tight tracking-wide text-cyan-50 drop-shadow-[0_0_6px_rgba(34,211,238,0.35)] sm:text-lg md:text-xl">
                  {team.teamName}
                </p>
                <MatchScoreCells team={team} matchNumbers={matchNumbers} mode={mode} obs />
                <span className="text-right font-mono text-lg font-black leading-none text-amber-300 drop-shadow-[0_0_10px_#f59e0b] sm:text-xl">
                  {team.totalPoints}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
