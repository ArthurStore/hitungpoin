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
    const anim = setInterval(() => {
      setEnterFrom((f) => (f === 'left' ? 'right' : 'left'));
      setTick((t) => t + 1);
    }, 14000);

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
  // Always dense enough for 15 rows on 1080p
  const gridCols = `28px minmax(0,1.4fr) repeat(${matchCols}, minmax(0,1fr)) 44px`;

  if (!tournament) {
    return (
      <div className="flex h-screen w-screen items-center justify-center overflow-hidden bg-transparent text-white/70">
        Loading overlay…
      </div>
    );
  }

  return (
    <div className="obs-overlay-root relative flex h-screen w-screen max-h-screen flex-col justify-between overflow-hidden bg-transparent p-2 text-white">
      <div className="relative z-10 flex h-full min-h-0 w-full flex-col overflow-hidden">
        <header className="flex w-full shrink-0 items-center justify-between border-b border-cyan-400/30 pb-1">
          <div className="min-w-0">
            <h1 className="font-display text-lg font-black uppercase leading-none tracking-[0.16em] text-white drop-shadow-[0_0_10px_#22d3ee] sm:text-xl md:text-2xl">
              LIVE SCORE
            </h1>
            <p className="mt-0.5 truncate text-[9px] uppercase tracking-[0.22em] text-fuchsia-300/80 sm:text-[10px]">
              {tournament.name}
            </p>
          </div>
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold ${
            connected ? 'bg-emerald/20 text-emerald' : 'bg-white/10 text-white/50'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald animate-pulse' : 'bg-white/40'}`} />
            {connected ? 'LIVE' : 'POLL'}
          </span>
        </header>

        <div
          className="mt-1 grid w-full shrink-0 items-end gap-0 px-0.5"
          style={{ gridTemplateColumns: gridCols }}
        >
          <span className="pb-0.5 text-[8px] font-bold text-cyan-200/60">#</span>
          <span className="pb-0.5 text-[8px] font-bold uppercase text-cyan-200/60">Team</span>
          <MatchTreeHeaders matchNumbers={matchNumbers} mode={mode} compact />
          <span className="pb-0.5 text-right text-[8px] font-bold text-cyan-200/60">TOTAL</span>
        </div>

        {/* Equal-height rows fill remaining viewport — fits 15 on 1080p */}
        <div
          className="mt-0.5 grid min-h-0 w-full flex-1 gap-0.5 overflow-hidden"
          style={{ gridTemplateRows: `repeat(${n}, minmax(0, 1fr))` }}
        >
          {standings.map((team, idx) => {
            const animName = enterFrom === 'left' ? 'overlaySlideLeft' : 'overlaySlideRight';
            return (
              <div
                key={`${team.teamId || team.teamName}-${tick}`}
                className="grid h-full min-h-0 w-full items-center gap-0 rounded border border-cyan-400/20 bg-black/55 px-1"
                style={{
                  gridTemplateColumns: gridCols,
                  animation: `${animName} 0.4s ease-out both`,
                  animationDelay: `${Math.min(idx, 8) * 0.03}s`,
                  boxShadow: team.rank <= 3 ? '0 0 8px rgba(34,211,238,0.16)' : 'none',
                }}
              >
                <span className={`font-display text-xs font-black leading-none sm:text-sm ${
                  team.rank <= 3 ? 'text-amber-300' : 'text-white/85'
                }`}>
                  {team.rank}
                </span>
                <p className="truncate font-display text-xs font-bold uppercase leading-none tracking-wide text-cyan-100 sm:text-sm">
                  {team.teamName}
                </p>
                <MatchScoreCells team={team} matchNumbers={matchNumbers} mode={mode} compact />
                <span className="text-right font-mono text-xs font-black leading-none text-amber-300 sm:text-sm">
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
