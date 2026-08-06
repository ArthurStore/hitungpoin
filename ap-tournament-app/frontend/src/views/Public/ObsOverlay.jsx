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

  // Lock page scroll for OBS browser source
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
  const teamCount = Math.max(standings.length, 1);

  // Scale typography by how many rows we need to fit
  const dense = teamCount >= 12;
  const veryDense = teamCount >= 14;
  const gridCols = `32px minmax(0,1.5fr) repeat(${matchCols}, minmax(0,1fr)) 48px`;

  if (!tournament) {
    return (
      <div className="flex h-screen w-screen items-center justify-center overflow-hidden bg-transparent text-white/70">
        Loading overlay…
      </div>
    );
  }

  return (
    <div className="obs-overlay-root flex h-screen w-screen max-h-screen flex-col overflow-hidden bg-transparent p-3 text-white sm:p-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="overlay-glow absolute -left-16 top-4 h-40 w-40 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, #22d3ee33, transparent 70%)' }}
        />
        <div
          className="overlay-glow absolute -right-8 bottom-6 h-44 w-44 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, #e879f933, transparent 70%)', animationDelay: '1s' }}
        />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="mb-1.5 flex shrink-0 items-center justify-between border-b border-cyan-400/30 pb-1.5">
          <div className="min-w-0">
            <h1 className={`font-display font-black uppercase tracking-[0.18em] text-white drop-shadow-[0_0_12px_#22d3ee] ${
              dense ? 'text-xl' : 'text-2xl sm:text-3xl'
            }`}>
              LIVE SCORE
            </h1>
            <p className="truncate text-[10px] uppercase tracking-[0.25em] text-fuchsia-300/80 sm:text-xs">
              {tournament.name}
            </p>
          </div>
          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
            connected ? 'bg-emerald/20 text-emerald' : 'bg-white/10 text-white/50'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald animate-pulse' : 'bg-white/40'}`} />
            {connected ? 'LIVE' : 'POLL'}
          </span>
        </header>

        <div
          className="mb-1 grid shrink-0 items-end gap-0.5 px-1"
          style={{ gridTemplateColumns: gridCols }}
        >
          <span className="pb-0.5 text-[9px] font-bold text-cyan-200/60">#</span>
          <span className="pb-0.5 text-[9px] font-bold uppercase text-cyan-200/60">Team</span>
          <MatchTreeHeaders matchNumbers={matchNumbers} mode={mode} compact />
          <span className="pb-0.5 text-right text-[9px] font-bold text-cyan-200/60">TOTAL</span>
        </div>

        {/* Rows autofit: flex-1 distributes remaining height across all 15 teams */}
        <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
          {standings.map((team, idx) => {
            const animName = enterFrom === 'left' ? 'overlaySlideLeft' : 'overlaySlideRight';
            return (
              <div
                key={`${team.teamId || team.teamName}-${tick}`}
                className="grid min-h-0 flex-1 items-center gap-0.5 rounded border border-cyan-400/20 bg-black/50 px-1.5 backdrop-blur-sm"
                style={{
                  gridTemplateColumns: gridCols,
                  paddingTop: veryDense ? 2 : dense ? 3 : 4,
                  paddingBottom: veryDense ? 2 : dense ? 3 : 4,
                  animation: `${animName} 0.45s ease-out both`,
                  animationDelay: `${Math.min(idx, 10) * 0.04}s`,
                  boxShadow: team.rank <= 3 ? '0 0 10px rgba(34,211,238,0.18)' : 'none',
                }}
              >
                <span className={`font-display font-black leading-none ${
                  team.rank <= 3 ? 'text-amber-300' : 'text-white/85'
                } ${dense ? 'text-sm' : 'text-base'}`}>
                  {team.rank}
                </span>
                <p className={`truncate font-display font-bold uppercase leading-tight tracking-wide text-cyan-100 ${
                  dense ? 'text-sm' : 'text-base'
                }`}>
                  {team.teamName}
                </p>
                <MatchScoreCells team={team} matchNumbers={matchNumbers} mode={mode} compact />
                <span className={`text-right font-mono font-black leading-none text-amber-300 drop-shadow-[0_0_6px_#f59e0b] ${
                  dense ? 'text-sm' : 'text-base'
                }`}>
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
