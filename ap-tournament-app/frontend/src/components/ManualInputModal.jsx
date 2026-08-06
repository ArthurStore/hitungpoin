import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  X, MagnifyingGlassPlus, MagnifyingGlassMinus, ArrowsOut, ArrowCounterClockwise,
  CaretLeft, CaretRight,
} from '@phosphor-icons/react';
import Button from './Button';
import {
  getScoringRules, getDefaultPlacementPoints, calcLiveTotal,
} from '../utils/pointsCalc';

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
    };
  });
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
  initialRows,
  nicknames = [],
  startStep = 3,
  onSubmit,
  submitting,
}) {
  const scoringRules = useMemo(() => getScoringRules(tournament), [tournament]);
  const urls = imageUrls?.length ? imageUrls : (imageUrl ? [imageUrl] : []);
  const killPt = scoringRules.killPoint ?? 1;

  const [step, setStep] = useState(startStep);
  const [rows, setRows] = useState(() => buildEmptyRows(scoringRules));
  const [nickMap, setNickMap] = useState([]);
  const [activeImg, setActiveImg] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const rules = getScoringRules(tournament);
    setStep(startStep);
    setActiveImg(0);

    const base = buildEmptyRows(rules);
    if (initialRows?.length) {
      initialRows.forEach((r) => {
        const idx = (r.placement || 1) - 1;
        if (idx < 0 || idx >= SLOT_COUNT) return;
        base[idx] = {
          ...base[idx],
          teamId: r.teamId || '',
          teamName: r.teamName || r.matchedTeamName || '',
          ocrNickname: r.ocrNickname || r.nickname || r.teamName || '',
          kills: r.kills ?? '',
          placementPoints: r.placementPoints != null
            ? r.placementPoints
            : placementPtsFor(r.placement || idx + 1, rules),
          players: r.players || [],
        };
      });
    }
    setRows(base);

    const nicks = nicknames.length
      ? nicknames
      : (initialRows || [])
        .filter((r) => r.teamName || r.nickname)
        .map((r) => ({
          nickname: r.nickname || r.teamName,
          kills: r.kills || 0,
          placements: r.placement ? [r.placement] : [],
        }));

    setNickMap(nicks.map((n) => {
      const matched = teams.find((t) => {
        const a = t.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const b = (n.nickname || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return a && b && (a === b || a.includes(b) || b.includes(a));
      });
      const fromRow = (initialRows || []).find(
        (r) => (r.nickname || r.teamName || '').toLowerCase() === (n.nickname || '').toLowerCase()
      );
      return {
        nickname: n.nickname,
        kills: n.kills || 0,
        placements: n.placements || [],
        teamId: fromRow?.teamId || matched?._id || '',
        teamName: fromRow?.teamName || matched?.name || '',
      };
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialRows, nicknames, startStep, teams, tournament]);

  const applyNickMapToRows = () => {
    setRows((prev) => {
      const next = prev.map((r) => ({ ...r }));
      nickMap.forEach((n) => {
        if (!n.teamId) return;
        const team = teams.find((t) => t._id === n.teamId);
        const place = n.placements?.[0];
        if (place && place >= 1 && place <= 12) {
          const idx = place - 1;
          next[idx] = {
            ...next[idx],
            teamId: n.teamId,
            teamName: team?.name || n.teamName,
            ocrNickname: n.nickname,
            kills: next[idx].kills !== '' ? next[idx].kills : (n.kills || ''),
          };
        } else {
          const empty = next.findIndex((r) => !r.teamId);
          if (empty >= 0) {
            next[empty] = {
              ...next[empty],
              teamId: n.teamId,
              teamName: team?.name || n.teamName,
              ocrNickname: n.nickname,
              kills: n.kills || '',
            };
          }
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
    const team = teams.find((t) => t._id === teamId);
    setRows((prev) => prev.map((r, i) =>
      i === idx ? { ...r, teamId, teamName: team?.name || '' } : r
    ));
  };

  const filledRows = useMemo(
    () => rows.filter((r) => r.teamId || r.teamName),
    [rows]
  );

  const goNext = () => {
    if (step === 1) {
      applyNickMapToRows();
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleSubmit = () => {
    const payload = filledRows.map((r) => {
      const kills = parseInt(r.kills, 10) || 0;
      const placementPoints = r.placementPoints != null && r.placementPoints !== ''
        ? parseInt(r.placementPoints, 10) || 0
        : placementPtsFor(r.placement, scoringRules);
      const total = calcLiveTotal({
        placement: r.placement,
        kills,
        placementPoints,
        mode: 'cr_biasa',
        scoringRules,
      });
      return {
        ...r,
        kills,
        placementPoints,
        totalPoints: total,
        totalScore: kills,
        ocrNickname: r.ocrNickname || r.nickname || '',
        players: r.players || [],
      };
    });
    onSubmit(payload);
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
              {step === 1 ? 'Step 1 · Roster / Nickname Matching' :
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
              {step === 1 && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-400">Konfirmasi nickname OCR → tim terdaftar.</p>
                  {nickMap.length === 0 ? (
                    <p className="rounded-xl bg-slate-800/50 p-4 text-sm text-slate-500">Tidak ada nickname. Lanjut ke Step 3 untuk input manual.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-white/5">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-white/10 text-[10px] uppercase text-slate-500">
                            <th className="px-3 py-2">OCR Nickname</th>
                            <th className="px-3 py-2">Kills</th>
                            <th className="px-3 py-2">Rank</th>
                            <th className="px-3 py-2">Map ke Tim</th>
                          </tr>
                        </thead>
                        <tbody>
                          {nickMap.map((n, i) => (
                            <tr key={i} className="border-b border-white/5">
                              <td className="px-3 py-2 font-mono text-xs text-cyan-300">{n.nickname}</td>
                              <td className="px-3 py-2 font-mono text-white">{n.kills}</td>
                              <td className="px-3 py-2 font-mono text-slate-400">{n.placements?.[0] ? `#${n.placements[0]}` : '—'}</td>
                              <td className="px-3 py-2">
                                <select
                                  value={n.teamId}
                                  onChange={(e) => {
                                    const team = teams.find((t) => t._id === e.target.value);
                                    setNickMap((prev) => prev.map((row, j) =>
                                      j === i ? { ...row, teamId: e.target.value, teamName: team?.name || '' } : row
                                    ));
                                  }}
                                  className="w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-sm text-white"
                                >
                                  <option value="">— Unmatched —</option>
                                  {teams.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {(step === 2 || step === 3) && (
                <div className="space-y-2">
                  <p className="mb-2 text-xs text-slate-400">
                    Input hanya <strong className="text-white">Kills</strong>. Placement Pts & Total dihitung otomatis:
                    {' '}<span className="font-mono text-emerald">Total = Kills × {killPt} + PlacementPts</span>
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-white/5">
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-white/10 bg-slate-800/40 text-[10px] uppercase tracking-wider text-slate-500">
                          <th className="w-16 px-2 py-2">Rank</th>
                          <th className="px-2 py-2">Nick / Team</th>
                          <th className="w-20 px-2 py-2">Kills</th>
                          <th className="w-24 px-2 py-2">Place Pts</th>
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
                              placementPoints: pp,
                              mode: 'cr_biasa',
                              scoringRules,
                            })
                            : '—';
                          const editable = step === 3;
                          const playersBackup = (row.players || []).map((p) => p.nickname || p).filter(Boolean).join(', ');

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
                                    <input
                                      type="text"
                                      value={row.ocrNickname || ''}
                                      onChange={(e) => updateField(idx, 'ocrNickname', e.target.value)}
                                      placeholder="Nick OCR"
                                      className="w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-xs text-cyan-300"
                                    />
                                    <select
                                      value={row.teamId}
                                      onChange={(e) => onTeamSelect(idx, e.target.value)}
                                      className="w-full min-w-[110px] rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-xs text-white"
                                    >
                                      <option value="">Select Team</option>
                                      {teams.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                                    </select>
                                    {playersBackup && (
                                      <p className="truncate text-[9px] text-slate-500" title={playersBackup}>
                                        Roster: {playersBackup}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <div>
                                    <span className="text-xs font-semibold text-white">
                                      {row.teamName || <span className="text-slate-600">—</span>}
                                    </span>
                                    {row.ocrNickname && (
                                      <p className="text-[10px] text-cyan-400/80">{row.ocrNickname}</p>
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
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                {step > 1 && (
                  <Button variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))}>
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
                  <Button variant="success" onClick={handleSubmit} loading={submitting} disabled={filledRows.length === 0}>
                    Apply to Leaderboard
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
