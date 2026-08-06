import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  X, MagnifyingGlassPlus, MagnifyingGlassMinus, ArrowCounterClockwise,
  ArrowsOut, CaretLeft, CaretRight, Plus,
} from '@phosphor-icons/react';
import Button from './Button';
import {
  getScoringRules, getDefaultPlacementPoints, calcLiveTotal,
} from '../utils/pointsCalc';
import { api } from '../utils/api';

const SLOT_COUNT = 12;
const STEPS = [
  { id: 1, label: 'Roster Match' },
  { id: 2, label: 'Score Preview' },
  { id: 3, label: 'Adjust & Submit' },
];

function placementPtsFor(placement, rules) {
  const base = getDefaultPlacementPoints(placement, rules);
  const bonus = placement === 1 ? (rules.booyahBonus || 0) : 0;
  return base + bonus;
}

function nickListFromRow(r) {
  const fromPlayers = (r.players || []).map((p) => p.nickname || p).filter(Boolean);
  if (fromPlayers.length) return fromPlayers.slice(0, 6);
  if (r.ocrNickname) {
    return String(r.ocrNickname).split(/[·|,]/).map((s) => s.trim()).filter(Boolean).slice(0, 6);
  }
  if (r.nickname) return [r.nickname];
  return [];
}

function buildEmptyRows(scoringRules) {
  return Array.from({ length: SLOT_COUNT }, (_, i) => {
    const placement = i + 1;
    return {
      placement,
      teamId: '',
      teamName: '',
      ocrNickname: '',
      kills: '',
      placementPoints: placementPtsFor(placement, scoringRules),
      players: [],
      nicknames: [],
    };
  });
}

function norm(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Fuzzy: exact, substring, or shared prefix (≥3 chars) */
function nickSimilar(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.length >= 3 && b.length >= 3) {
    if (a.includes(b) || b.includes(a)) return 85;
    const len = Math.min(a.length, b.length, 4);
    if (a.slice(0, len) === b.slice(0, len)) return 70;
  }
  return 0;
}

/**
 * Score OCR group vs master team.
 * Match by roster nicknames OR team name (fuzzy) — not requiring identical names.
 */
export function scoreTeamMatch(ocrNicknames, team) {
  const ocrNorms = [...new Set((ocrNicknames || []).map(norm).filter(Boolean))];
  if (!ocrNorms.length || !team) return 0;

  const teamNorm = norm(team.name);
  const rosterNorms = [...new Set(
    (team.players || []).map((p) => norm(p.nickname || p.name || p)).filter(Boolean)
  )];

  let best = 0;

  // Nickname OCR ↔ nama tim
  ocrNorms.forEach((n) => {
    best = Math.max(best, nickSimilar(n, teamNorm));
  });

  // Nickname OCR ↔ roster (termasuk cadangan)
  let rosterHits = 0;
  let rosterBest = 0;
  ocrNorms.forEach((n) => {
    let hit = 0;
    rosterNorms.forEach((r) => {
      hit = Math.max(hit, nickSimilar(n, r));
    });
    if (hit >= 70) rosterHits += 1;
    rosterBest = Math.max(rosterBest, hit);
  });

  if (rosterHits >= 2) best = Math.max(best, 92 + rosterHits);
  else if (rosterHits === 1) best = Math.max(best, 78);
  else best = Math.max(best, rosterBest >= 85 ? 75 : 0);

  return best;
}

function findBestTeam(ocrNicknames, teamsList, usedTeamIds = new Set()) {
  let best = null;
  let bestScore = 0;
  (teamsList || []).forEach((t) => {
    if (usedTeamIds.has(String(t._id))) return;
    const score = scoreTeamMatch(ocrNicknames, t);
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  });
  // Auto-select hanya jika cukup yakin
  if (bestScore >= 70) return { team: best, score: bestScore };
  return { team: null, score: bestScore };
}

function ImageViewer({ imageUrls = [], activeIndex = 0, onSelectImage }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageUrl = imageUrls[activeIndex] || imageUrls[0];

  const handleMouseDown = (e) => {
    if (!imageUrl) return;
    e.preventDefault();
    setDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = useCallback((e) => {
    if (!dragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }, [dragging, dragStart]);

  useEffect(() => {
    if (!dragging) return undefined;
    const up = () => setDragging(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', up);
    };
  }, [dragging, handleMouseMove]);

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [activeIndex, imageUrl]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2">
        <button type="button" onClick={() => setZoom((z) => Math.min(4, z + 0.25))} className="rounded p-1.5 text-slate-400 hover:bg-white/5 hover:text-white">
          <MagnifyingGlassPlus size={18} />
        </button>
        <button type="button" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="rounded p-1.5 text-slate-400 hover:bg-white/5 hover:text-white">
          <MagnifyingGlassMinus size={18} />
        </button>
        <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="rounded p-1.5 text-slate-400 hover:bg-white/5 hover:text-white">
          <ArrowCounterClockwise size={18} />
        </button>
        <span className="ml-auto font-mono text-xs text-slate-500">{Math.round(zoom * 100)}% · Drag to pan</span>
      </div>
      {imageUrls.length > 1 && (
        <div className="flex gap-1 border-b border-white/5 px-2 py-1.5">
          {imageUrls.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onSelectImage?.(i)}
              className={`rounded px-2 py-0.5 text-[10px] font-bold ${i === activeIndex ? 'bg-emerald/20 text-emerald' : 'bg-slate-800 text-slate-500'}`}
            >
              SS{i + 1}
            </button>
          ))}
        </div>
      )}
      <div
        className="relative min-h-[200px] flex-1 overflow-hidden bg-black/40"
        onMouseDown={handleMouseDown}
        style={{ cursor: imageUrl ? (dragging ? 'grabbing' : 'grab') : 'default' }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Scoreboard"
            draggable={false}
            className="pointer-events-none absolute left-1/2 top-1/2 max-h-none max-w-none select-none"
            style={{ transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})` }}
          />
        ) : (
          <p className="flex h-full items-center justify-center text-sm text-slate-500">No image</p>
        )}
      </div>
    </div>
  );
}

export default function ManualInputModal({
  open,
  onClose,
  imageUrl,
  imageUrls,
  teams = [],
  tournament,
  inputMode: inputModeProp,
  initialRows,
  nicknames = [],
  teamGroups = [],
  startStep = 3,
  onSubmit,
  submitting,
  onTeamsUpdated,
}) {
  const scoringRules = useMemo(
    () => getScoringRules(tournament),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tournament?._id, tournament?.scoringRules, tournament?.inputMode]
  );
  const urls = imageUrls?.length ? imageUrls : (imageUrl ? [imageUrl] : []);
  const killPt = scoringRules.killPoint ?? 1;
  const isLeague = (inputModeProp || tournament?.inputMode || 'cr_biasa') === 'cr_league';
  const mode = isLeague ? 'cr_league' : 'cr_biasa';
  const tournamentId = tournament?._id;

  const [step, setStep] = useState(startStep);
  const [rows, setRows] = useState(() => buildEmptyRows(scoringRules));
  const [groupMap, setGroupMap] = useState([]);
  const [activeImg, setActiveImg] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [creatingIdx, setCreatingIdx] = useState(null);
  const [creating, setCreating] = useState(false);
  const [localTeams, setLocalTeams] = useState(teams);
  const [toastMsg, setToastMsg] = useState('');
  const [toastError, setToastError] = useState(false);

  // Session lock: only full-init when modal opens (false → true)
  const wasOpenRef = useRef(false);
  const initPayloadRef = useRef(null);

  const showToast = (msg, isError = false) => {
    setToastMsg(msg);
    setToastError(isError);
  };

  /** Merge parent teams into local list WITHOUT wiping selections */
  useEffect(() => {
    if (!open) return;
    setLocalTeams((prev) => {
      const map = new Map(prev.map((t) => [String(t._id), t]));
      (teams || []).forEach((t) => map.set(String(t._id), t));
      return Array.from(map.values());
    });
  }, [teams, open]);

  const buildGroupsFromProps = useCallback((teamsList) => {
    let groups = [];
    if (teamGroups?.length) {
      groups = teamGroups.map((g) => ({
        placement: g.placement,
        kills: g.kills || 0,
        nicknames: g.nicknames || (g.players || []).map((p) => p.nickname || p).filter(Boolean),
        players: g.players || [],
        teamId: g.teamId || '',
        teamName: g.teamName || '',
        draftName: '',
      }));
    } else if (initialRows?.length) {
      groups = initialRows
        .filter((r) => r.placement || r.nickname || r.teamName || (r.players || []).length)
        .map((r) => {
          const nicks = nickListFromRow(r);
          return {
            placement: r.placement,
            kills: r.kills || 0,
            nicknames: nicks,
            players: r.players || nicks.map((n) => ({ nickname: n })),
            teamId: r.teamId || '',
            teamName: r.teamName || r.matchedTeamName || '',
            draftName: '',
          };
        });
    } else if (nicknames?.length) {
      const byPlace = new Map();
      nicknames.forEach((n) => {
        const place = n.placements?.[0] || 0;
        if (!byPlace.has(place)) byPlace.set(place, { placement: place || null, kills: 0, nicknames: [], players: [] });
        const g = byPlace.get(place);
        g.nicknames.push(n.nickname);
        g.players.push({ nickname: n.nickname, kills: n.kills || 0 });
        g.kills = Math.max(g.kills, n.kills || 0);
      });
      groups = Array.from(byPlace.values()).map((g) => ({ ...g, teamId: '', teamName: '', draftName: '' }));
    }

    // Fuzzy auto-match; 1 tim = 1 slot
    const used = new Set();
    return groups.map((g) => {
      if (g.teamId) {
        used.add(String(g.teamId));
        return g;
      }
      const { team } = findBestTeam(g.nicknames, teamsList, used);
      if (!team) return g;
      used.add(String(team._id));
      return { ...g, teamId: team._id, teamName: team.name };
    });
  }, [teamGroups, initialRows, nicknames]);

  // Full init ONLY when modal opens
  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) return; // already initialized this session
    wasOpenRef.current = true;

    const rules = getScoringRules(tournament);
    const teamsSnapshot = teams || [];
    setLocalTeams(teamsSnapshot);
    setStep(startStep);
    setActiveImg(0);
    setCreatingIdx(null);
    setToastMsg('');
    setToastError(false);

    const base = buildEmptyRows(rules);
    if (initialRows?.length) {
      initialRows.forEach((r) => {
        const idx = (r.placement || 1) - 1;
        if (idx < 0 || idx >= SLOT_COUNT) return;
        const nicks = nickListFromRow(r);
        base[idx] = {
          ...base[idx],
          teamId: r.teamId || '',
          teamName: r.teamName || r.matchedTeamName || '',
          ocrNickname: nicks.join(' · ') || r.ocrNickname || r.nickname || r.teamName || '',
          kills: r.kills ?? r.totalScore ?? '',
          placementPoints: r.placementPoints != null
            ? r.placementPoints
            : placementPtsFor(r.placement || idx + 1, rules),
          players: r.players || nicks.map((n) => ({ nickname: n })),
          nicknames: nicks,
        };
      });
    }
    setRows(base);

    const matched = buildGroupsFromProps(teamsSnapshot);
    setGroupMap(matched);
    initPayloadRef.current = { startStep, rowsLen: initialRows?.length || 0 };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const findDuplicateTeam = (teamId, excludeIndex, source = 'group') => {
    if (!teamId) return null;
    const id = String(teamId);
    if (source === 'group') {
      const hit = groupMap.find((g, j) => j !== excludeIndex && String(g.teamId) === id);
      return hit ? hit.placement : null;
    }
    const hit = rows.find((r, j) => j !== excludeIndex && String(r.teamId) === id);
    return hit ? hit.placement : null;
  };

  const assignGroupTeam = (groupIdx, teamId, teamName) => {
    if (teamId) {
      const dupRank = findDuplicateTeam(teamId, groupIdx, 'group');
      if (dupRank != null) {
        showToast(`Tim ${teamName || 'ini'} sudah ditautkan di Rank #${dupRank}!`, true);
        setGroupMap((prev) => prev.map((row, j) =>
          j === groupIdx ? { ...row, teamId: '', teamName: '' } : row
        ));
        return false;
      }
    }
    setGroupMap((prev) => prev.map((row, j) =>
      j === groupIdx ? { ...row, teamId: teamId || '', teamName: teamName || '' } : row
    ));
    return true;
  };

  const applyGroupMapToRows = () => {
    setRows((prev) => {
      const next = prev.map((r) => ({ ...r }));
      groupMap.forEach((g) => {
        if (!g.teamId && !g.teamName) return;
        const team = localTeams.find((t) => t._id === g.teamId);
        const place = g.placement;
        if (place && place >= 1 && place <= 12) {
          const idx = place - 1;
          const nicks = g.nicknames || [];
          next[idx] = {
            ...next[idx],
            teamId: g.teamId,
            teamName: team?.name || g.teamName,
            ocrNickname: nicks.join(' · '),
            nicknames: nicks,
            players: g.players || nicks.map((n) => ({ nickname: n })),
            kills: next[idx].kills !== '' ? next[idx].kills : (g.kills || ''),
          };
        }
      });
      return next;
    });
  };

  const updateKills = (idx, value) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, kills: value } : r)));
  };

  const updateField = (idx, field, value) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const onTeamSelect = (idx, teamId) => {
    const team = localTeams.find((t) => t._id === teamId);
    if (teamId) {
      const dupRank = findDuplicateTeam(teamId, idx, 'rows');
      if (dupRank != null) {
        showToast(`Tim ${team?.name || 'ini'} sudah ditautkan di Rank #${dupRank}!`, true);
        setRows((prev) => prev.map((r, i) =>
          i === idx ? { ...r, teamId: '', teamName: '' } : r
        ));
        return;
      }
    }
    setRows((prev) => prev.map((r, i) =>
      i === idx ? { ...r, teamId, teamName: team?.name || '' } : r
    ));
  };

  const createTeamFromGroup = async (groupIdx) => {
    const g = groupMap[groupIdx];
    const name = (g.draftName || '').trim();
    if (!name) {
      showToast('Isi nama tim dulu (mis. EXC)', true);
      return;
    }
    if (!tournamentId) return;

    // Duplikat nama lokal
    const nameDup = groupMap.find((row, j) =>
      j !== groupIdx && row.teamName && row.teamName.toLowerCase() === name.toLowerCase() && row.teamId
    );
    if (nameDup) {
      showToast(`Tim "${name}" sudah ditautkan di Rank #${nameDup.placement}!`, true);
      return;
    }

    setCreating(true);
    showToast('');
    try {
      const players = (g.nicknames || []).slice(0, 6).map((n) => ({ nickname: n }));
      const team = await api.upsertTeam(tournamentId, {
        name,
        players,
        representative: players[0]?.nickname || '',
        merge: true,
      });

      // 1) Add to local list first
      setLocalTeams((prev) => {
        const exists = prev.some((t) => String(t._id) === String(team._id));
        return exists
          ? prev.map((t) => (String(t._id) === String(team._id) ? team : t))
          : [...prev, team];
      });

      // 2) Lock selection on THIS slot immediately (before any parent refresh)
      setGroupMap((prev) => prev.map((row, j) =>
        j === groupIdx
          ? { ...row, teamId: team._id, teamName: team.name, draftName: '' }
          : row
      ));
      setCreatingIdx(null);
      showToast(`Tim "${team.name}" dibuat + roster ${players.length} nick`);

      // Soft notify parent — must NOT wipe modal state
      try {
        await onTeamsUpdated?.(team, { soft: true });
      } catch { /* ignore */ }
    } catch (err) {
      showToast(err.message || 'Gagal buat tim', true);
    } finally {
      setCreating(false);
    }
  };

  const filledRows = useMemo(
    () => rows.filter((r) => r.teamId || r.teamName),
    [rows]
  );

  const goNext = () => {
    if (step === 1) {
      // Warn duplicates before leaving step 1
      const seen = new Map();
      for (const g of groupMap) {
        if (!g.teamId) continue;
        const id = String(g.teamId);
        if (seen.has(id)) {
          showToast(`Tim ${g.teamName} sudah ditautkan di Rank #${seen.get(id)}!`, true);
          return;
        }
        seen.set(id, g.placement);
      }
      applyGroupMapToRows();
      setStep(2);
      showToast('');
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleSubmit = () => {
    // Stay on step 3 — validate, never force back to step 1
    const linked = rows.filter((r) => r.teamId || r.teamName);
    if (!linked.length) {
      showToast('Gagal Submit: belum ada rank yang ditautkan ke Tim!', true);
      return;
    }

    const seen = new Map();
    const dups = [];
    linked.forEach((r) => {
      if (!r.teamId) return;
      const id = String(r.teamId);
      if (seen.has(id)) dups.push(`#${r.placement} & #${seen.get(id)} (${r.teamName})`);
      else seen.set(id, r.placement);
    });
    if (dups.length) {
      showToast(`Gagal Submit: Tim duplikat di Rank ${dups.join(', ')}`, true);
      return;
    }

    const withScore = linked.filter((r) => r.kills === '' || r.kills == null);
    if (withScore.length && isLeague) {
      showToast(
        `Peringatan: Rank ${withScore.map((r) => `#${r.placement}`).join(', ')} belum punya SCORE — tetap dikirim sebagai 0`,
        true
      );
    }

    const payload = linked.map((r) => {
      const kills = parseInt(r.kills, 10) || 0;
      const placementPoints = isLeague
        ? 0
        : (r.placementPoints != null && r.placementPoints !== ''
          ? parseInt(r.placementPoints, 10) || 0
          : placementPtsFor(r.placement, scoringRules));
      const total = calcLiveTotal({
        placement: r.placement,
        kills,
        placementPoints,
        mode,
        scoringRules,
      });
      const nicks = r.nicknames?.length ? r.nicknames : nickListFromRow(r);
      return {
        ...r,
        kills,
        placementPoints,
        totalPoints: total,
        totalScore: kills,
        ocrNickname: nicks.join(' · ') || r.ocrNickname || '',
        players: r.players?.length ? r.players : nicks.map((n) => ({ nickname: n })),
        nicknames: nicks,
      };
    });

    showToast('Mengirim ke leaderboard…');
    Promise.resolve(onSubmit(payload)).then(() => {
      // Parent closes modal on success
    }).catch((err) => {
      showToast(`Gagal Submit: ${err?.message || 'unknown error'}`, true);
      // Tetap di Step 3 — jangan reset ke Step 1
    });
  };

  if (!open) return null;

  const inputCls = 'w-16 rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 font-mono text-sm text-white';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm">
      <div className={`flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl ${
        fullscreen ? 'h-[100dvh] w-full max-w-none' : 'h-[92dvh] w-full max-w-7xl'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <div>
            <h2 className="font-bold text-white">
              {step === 1 ? 'Step 1 · Roster / Tim Matching' :
               step === 2 ? 'Step 2 · Match Scores Preview' :
               'Step 3 · Adjust & Submit'}
            </h2>
            <div className="mt-1.5 flex gap-1">
              {STEPS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { if (s.id <= step || s.id === 3) setStep(s.id); }}
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    step === s.id ? 'bg-emerald text-white' :
                    step > s.id ? 'bg-emerald/20 text-emerald' : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {s.id}. {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setFullscreen((f) => !f)} className="rounded-lg p-2 text-slate-400 hover:bg-white/5">
              <ArrowsOut size={18} />
            </button>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/5">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
          <div className="flex max-h-[40%] flex-col border-b border-white/10 lg:max-h-none lg:w-[42%] lg:border-b-0 lg:border-r">
            <ImageViewer imageUrls={urls} activeIndex={activeImg} onSelectImage={setActiveImg} />
          </div>

          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4">
              {toastMsg && (
                <p className={`mb-3 rounded-lg px-3 py-2 text-xs ${
                  toastError ? 'bg-crimson/20 text-red-300' : 'bg-emerald/15 text-emerald'
                }`}>
                  {toastMsg}
                </p>
              )}

              {step === 1 && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400">
                    Setiap baris = <strong className="text-white">1 tim (hingga 4 nickname)</strong>.
                    1 tim hanya boleh 1 rank. Auto-match fuzzy dari roster/nama.
                  </p>
                  {groupMap.length === 0 ? (
                    <p className="rounded-xl bg-slate-800/50 p-4 text-sm text-slate-500">
                      Tidak ada hasil OCR. Lanjut ke Step 3 untuk input manual.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {groupMap.map((g, i) => (
                        <div
                          key={`g-${g.placement}-${i}`}
                          className={`rounded-xl border p-3 ${
                            g.teamId ? 'border-emerald/30 bg-slate-800/40' : 'border-white/10 bg-slate-800/40'
                          }`}
                        >
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-bold text-amber-300">
                              #{g.placement || '—'} · {g.kills} {isLeague ? 'score' : 'kills'}
                            </span>
                            {g.teamId && (
                              <span className="rounded-full bg-emerald/20 px-2 py-0.5 text-[10px] font-bold text-emerald">
                                → {g.teamName}
                              </span>
                            )}
                          </div>
                          <div className="mb-3 flex flex-wrap gap-1.5">
                            {(g.nicknames || []).length === 0 ? (
                              <span className="text-xs text-slate-500">—</span>
                            ) : (
                              (g.nicknames || []).map((n, ni) => (
                                <span
                                  key={ni}
                                  className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 font-mono text-[11px] text-cyan-300"
                                >
                                  {n}
                                </span>
                              ))
                            )}
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <select
                              value={g.teamId || ''}
                              onChange={async (e) => {
                                const teamId = e.target.value;
                                const team = localTeams.find((t) => String(t._id) === String(teamId));
                                const ok = assignGroupTeam(i, teamId, team?.name || '');
                                if (!ok || !team || !tournamentId) return;
                                // Sync roster silently — do not refresh parent hard
                                if ((g.nicknames || []).length) {
                                  try {
                                    const updated = await api.upsertTeam(tournamentId, {
                                      teamId: team._id,
                                      name: team.name,
                                      players: (g.nicknames || []).map((n) => ({ nickname: n })),
                                      merge: true,
                                    });
                                    setLocalTeams((prev) => prev.map((t) =>
                                      String(t._id) === String(updated._id) ? updated : t
                                    ));
                                    await onTeamsUpdated?.(updated, { soft: true });
                                  } catch { /* non-fatal */ }
                                }
                              }}
                              className="flex-1 rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-sm text-white"
                            >
                              <option value="">— Pilih / buat tim —</option>
                              {localTeams.map((t) => (
                                <option key={t._id} value={t._id}>{t.name}</option>
                              ))}
                            </select>
                            {creatingIdx === i ? (
                              <div className="flex flex-1 gap-1">
                                <input
                                  type="text"
                                  value={g.draftName || ''}
                                  onChange={(e) => setGroupMap((prev) => prev.map((row, j) =>
                                    j === i ? { ...row, draftName: e.target.value } : row
                                  ))}
                                  placeholder="Nama tim (EXC)"
                                  className="min-w-0 flex-1 rounded-lg border border-emerald/40 bg-slate-900 px-2 py-1.5 text-sm text-white"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') createTeamFromGroup(i);
                                  }}
                                />
                                <Button
                                  variant="success"
                                  onClick={() => createTeamFromGroup(i)}
                                  loading={creating}
                                  disabled={creating}
                                >
                                  Simpan
                                </Button>
                                <Button variant="ghost" onClick={() => setCreatingIdx(null)}>Batal</Button>
                              </div>
                            ) : (
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  setCreatingIdx(i);
                                  setGroupMap((prev) => prev.map((row, j) =>
                                    j === i ? { ...row, draftName: row.draftName || '' } : row
                                  ));
                                }}
                              >
                                <Plus size={14} /> Buat Tim Baru dari OCR
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {(step === 2 || step === 3) && (
                <div className="space-y-2">
                  <p className="mb-2 text-xs text-slate-400">
                    {isLeague ? (
                      <>
                        Mode CR League: input <strong className="text-white">SCORE</strong> saja.
                        Angka tersebut langsung jadi Total (tanpa Place Pts).
                      </>
                    ) : (
                      <>
                        Input hanya <strong className="text-white">Kills</strong>. Placement Pts & Total dihitung otomatis:
                        {' '}<span className="font-mono text-emerald">Total = Kills × {killPt} + PlacementPts</span>
                      </>
                    )}
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-white/5">
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-white/10 bg-slate-800/40 text-[10px] uppercase tracking-wider text-slate-500">
                          <th className="w-16 px-2 py-2">Rank</th>
                          <th className="px-2 py-2">Nick / Team</th>
                          <th className="w-20 px-2 py-2">{isLeague ? 'Score' : 'Kills'}</th>
                          {!isLeague && <th className="w-24 px-2 py-2">Place Pts</th>}
                          <th className="w-16 px-2 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, idx) => {
                          const pp = row.placementPoints != null && row.placementPoints !== ''
                            ? parseInt(row.placementPoints, 10) || 0
                            : placementPtsFor(row.placement, scoringRules);
                          const liveTotal = (row.teamId || row.teamName)
                            ? calcLiveTotal({
                              placement: row.placement,
                              kills: row.kills,
                              placementPoints: isLeague ? 0 : pp,
                              mode,
                              scoringRules,
                            })
                            : '—';
                          const editable = step === 3;
                          const nicks = row.nicknames?.length ? row.nicknames : nickListFromRow(row);

                          return (
                            <tr
                              key={idx}
                              className={`border-b border-white/5 ${
                                row.placement === 1 ? 'bg-gold/5' :
                                row.placement === 2 ? 'bg-slate-400/5' :
                                row.placement === 3 ? 'bg-amber-900/10' : ''
                              }`}
                            >
                              <td className="px-2 py-1.5">
                                {editable ? (
                                  <input
                                    type="number"
                                    min="1"
                                    max="12"
                                    value={row.placement}
                                    onChange={(e) => updateField(idx, 'placement', parseInt(e.target.value, 10) || 1)}
                                    className={inputCls}
                                  />
                                ) : (
                                  <span className={`text-xs font-bold ${
                                    row.placement === 1 ? 'text-gold' : row.placement <= 3 ? 'text-slate-200' : 'text-slate-500'
                                  }`}>#{row.placement}</span>
                                )}
                              </td>
                              <td className="px-2 py-1.5">
                                {editable ? (
                                  <div className="space-y-1">
                                    <div className="flex flex-wrap gap-1">
                                      {nicks.length ? nicks.map((n, ni) => (
                                        <span key={ni} className="rounded bg-cyan-500/15 px-1.5 py-0.5 font-mono text-[10px] text-cyan-300">
                                          {n}
                                        </span>
                                      )) : (
                                        <input
                                          type="text"
                                          value={row.ocrNickname || ''}
                                          onChange={(e) => updateField(idx, 'ocrNickname', e.target.value)}
                                          placeholder="Nick OCR"
                                          className="w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-xs text-cyan-300"
                                        />
                                      )}
                                    </div>
                                    <select
                                      value={row.teamId || ''}
                                      onChange={(e) => onTeamSelect(idx, e.target.value)}
                                      className="w-full min-w-[110px] rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-xs text-white"
                                    >
                                      <option value="">Select Team</option>
                                      {localTeams.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                                    </select>
                                  </div>
                                ) : (
                                  <div>
                                    <span className="text-xs font-semibold text-white">
                                      {row.teamName || <span className="text-slate-600">—</span>}
                                    </span>
                                    {nicks.length > 0 && (
                                      <p className="mt-0.5 flex flex-wrap gap-1">
                                        {nicks.map((n, ni) => (
                                          <span key={ni} className="rounded bg-slate-800 px-1 text-[9px] text-cyan-400/80">{n}</span>
                                        ))}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="px-2 py-1.5">
                                {editable ? (
                                  <input
                                    type="number"
                                    min="0"
                                    value={row.kills}
                                    onChange={(e) => updateKills(idx, e.target.value)}
                                    className={inputCls}
                                    placeholder="0"
                                  />
                                ) : (
                                  <span className="font-mono text-white">{row.kills === '' ? '—' : row.kills}</span>
                                )}
                              </td>
                              {!isLeague && (
                                <td className="px-2 py-1.5">
                                  {editable ? (
                                    <input
                                      type="number"
                                      value={pp}
                                      onChange={(e) => updateField(idx, 'placementPoints', e.target.value)}
                                      className={inputCls}
                                    />
                                  ) : (
                                    <span className="font-mono text-slate-300">{pp}</span>
                                  )}
                                </td>
                              )}
                              <td className="px-2 py-1.5 text-right font-mono text-sm font-bold text-emerald">{liveTotal}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 p-4">
              <div className="flex gap-2">
                <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
                {step > 1 && (
                  <Button variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={submitting}>
                    <CaretLeft size={16} /> Back
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                {step < 3 ? (
                  <Button variant="secondary" onClick={goNext}>
                    Next <CaretRight size={16} />
                  </Button>
                ) : (
                  <Button
                    variant="success"
                    onClick={handleSubmit}
                    loading={submitting}
                    disabled={submitting || filledRows.length === 0}
                  >
                    {submitting ? 'Mengirim…' : 'Apply to Leaderboard'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
