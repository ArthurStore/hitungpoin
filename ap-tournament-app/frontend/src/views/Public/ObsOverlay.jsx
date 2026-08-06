import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { api, resolveAssetUrl, API_BASE } from '../../utils/api';
import { MatchTreeHeaders, MatchScoreCells, matchColumnCount } from '../../components/MatchTreeHeaders';

function socketOrigin() {
  return API_BASE.replace(/\/api\/?$/, '');
}

function slugify(name = '') {
  return String(name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function ObsOverlay() {
  const { tournamentSlug } = useParams();
  const [payload, setPayload] = useState(null);
  const [tick, setTick] = useState(0);
  const [connected, setConnected] = useState(false);
  const [enterFrom, setEnterFrom] = useState('left');
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
  const standings = useMemo(() => (payload?.standings || []).slice(0, 12), [payload]);
  const mode = tournament?.inputMode || 'cr_biasa';
  const totalMatches = tournament?.totalMatches || 6;
  const matchNumbers = Array.from({ length: totalMatches }, (_, i) => i + 1);
  const matchCols = matchColumnCount(totalMatches, mode);

  if (!tournament) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-transparent text-white/70">
        Loading overlay…
      </div>
    );
  }

  return (
    <div
      className="relative mx-auto overflow-hidden bg-transparent text-white"
      style={{ width: '100%', maxWidth: 1280, aspectRatio: '16 / 9' }}
    >
      <div className="pointer-events-none absolute inset-0">
        <div
          className="overlay-glow absolute -left-20 top-6 h-48 w-48 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, #22d3ee44, transparent 70%)' }}
        />
        <div
          className="overlay-glow absolute -right-10 bottom-10 h-56 w-56 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, #e879f944, transparent 70%)', animationDelay: '1s' }}
        />
        <div className="overlay-scanline absolute inset-x-0 h-20 bg-gradient-to-b from-cyan-400/15 to-transparent" />
      </div>

      <div className="relative z-10 flex h-full flex-col px-6 py-5">
        {/* No tournament logo — LIVE SCORE + Free Fire mark only */}
        <header className="mb-3 flex items-center justify-between border-b border-cyan-400/35 pb-3">
          <div className="flex items-center gap-3">
            <img
              src="/free-fire-logo.png"
              alt="Free Fire"
              className="h-12 w-16 object-contain"
              style={{ background: 'transparent' }}
            />
            <div>
              <h1 className="font-display text-3xl font-black uppercase tracking-[0.2em] text-white drop-shadow-[0_0_14px_#22d3ee]">
                LIVE SCORE
              </h1>
              <p className="text-xs uppercase tracking-[0.3em] text-fuchsia-300/80">{tournament.name}</p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${connected ? 'bg-emerald/20 text-emerald' : 'bg-white/10 text-white/50'}`}>
            <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald animate-pulse' : 'bg-white/40'}`} />
            {connected ? 'LIVE' : 'POLL'}
          </span>
        </header>

        <div
          className="mb-2 grid items-end gap-1"
          style={{ gridTemplateColumns: `36px 36px minmax(0,1.5fr) repeat(${matchCols}, minmax(0,1fr)) 56px` }}
        >
          <span className="pb-1 text-[10px] font-bold text-cyan-200/60">#</span>
          <span />
          <span className="pb-1 text-[10px] font-bold uppercase text-cyan-200/60">Team</span>
          <MatchTreeHeaders matchNumbers={matchNumbers} mode={mode} />
          <span className="pb-1 text-right text-[10px] font-bold text-cyan-200/60">TOTAL</span>
        </div>

        <div className="flex flex-1 flex-col justify-start gap-1.5 overflow-hidden">
          {standings.map((team, idx) => {
            const animName = enterFrom === 'left' ? 'overlaySlideLeft' : 'overlaySlideRight';
            return (
              <div
                key={`${team.teamId || team.teamName}-${tick}`}
                className="grid items-center gap-1 rounded-lg border border-cyan-400/25 bg-black/55 px-2 py-2 backdrop-blur-md"
                style={{
                  gridTemplateColumns: `36px 36px minmax(0,1.5fr) repeat(${matchCols}, minmax(0,1fr)) 56px`,
                  animation: `${animName} 0.55s ease-out both`,
                  animationDelay: `${idx * 0.08}s`,
                  boxShadow: team.rank <= 3 ? '0 0 16px rgba(34,211,238,0.22)' : 'none',
                }}
              >
                <span className={`font-display text-lg font-black ${team.rank <= 3 ? 'text-amber-300' : 'text-white/85'}`}>
                  {team.rank}
                </span>
                {team.logo ? (
                  <img src={resolveAssetUrl(team.logo)} alt="" className="h-8 w-8 object-contain" style={{ background: 'transparent' }} />
                ) : (
                  <span className="text-center text-xs text-white/30">{(team.teamName || '?')[0]}</span>
                )}
                <p className="truncate font-display text-base font-bold uppercase tracking-wide text-white">
                  {team.teamName}
                </p>
                <MatchScoreCells team={team} matchNumbers={matchNumbers} mode={mode} />
                <span className="text-right font-mono text-xl font-black text-amber-300 drop-shadow-[0_0_8px_#f59e0b]">
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
