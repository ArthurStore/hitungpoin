import { useState, useRef, useCallback, useEffect } from 'react';
import { X, MagnifyingGlassPlus, MagnifyingGlassMinus, ArrowsOut, ArrowCounterClockwise } from '@phosphor-icons/react';
import Button from './Button';
import { calcSingleRowPoints, getScoringRules } from '../utils/pointsCalc';

const SLOT_COUNT = 12;

function buildEmptyRows() {
  return Array.from({ length: SLOT_COUNT }, (_, i) => ({
    placement: i + 1,
    teamId: '',
    teamName: '',
    kills: '',
    totalScore: '',
  }));
}

export default function ManualInputModal({
  open,
  onClose,
  imageUrl,
  teams = [],
  inputMode = 'cr_biasa',
  tournament,
  initialRows,
  onSubmit,
  submitting,
}) {
  const [rows, setRows] = useState(buildEmptyRows());
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [fullscreen, setFullscreen] = useState(false);
  const imgWrapRef = useRef(null);

  const scoringRules = getScoringRules(tournament);

  useEffect(() => {
    if (open) {
      setRows(initialRows?.length ? initialRows : buildEmptyRows());
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [open, initialRows]);

  const updateRow = (idx, field, value) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const onTeamSelect = (idx, teamId) => {
    const team = teams.find((t) => t._id === teamId);
    setRows((prev) => prev.map((r, i) =>
      i === idx ? { ...r, teamId, teamName: team?.name || '' } : r
    ));
  };

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

  const handleMouseUp = () => setDragging(false);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove]);

  if (!open) return null;

  const filledRows = rows.filter((r) => r.teamId || r.teamName);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className={`flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl ${
        fullscreen ? 'h-[100dvh] w-full max-w-none' : 'h-[90dvh] w-full max-w-6xl'
      }`}>
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="font-bold text-white">Manual Input Match Results</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
          <div className="flex flex-col border-b border-white/10 lg:w-1/2 lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2">
              <button type="button" onClick={() => setZoom((z) => Math.min(4, z + 0.25))} className="rounded p-1.5 text-slate-400 hover:bg-white/5 hover:text-white" title="Zoom In">
                <MagnifyingGlassPlus size={18} />
              </button>
              <button type="button" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="rounded p-1.5 text-slate-400 hover:bg-white/5 hover:text-white" title="Zoom Out">
                <MagnifyingGlassMinus size={18} />
              </button>
              <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="rounded p-1.5 text-slate-400 hover:bg-white/5 hover:text-white" title="Reset">
                <ArrowCounterClockwise size={18} />
              </button>
              <button type="button" onClick={() => setFullscreen((f) => !f)} className="rounded p-1.5 text-slate-400 hover:bg-white/5 hover:text-white" title="Fullscreen">
                <ArrowsOut size={18} />
              </button>
              <span className="ml-auto font-mono text-xs text-slate-500">{Math.round(zoom * 100)}% · Drag to pan</span>
            </div>
            <div
              ref={imgWrapRef}
              className="relative flex-1 overflow-hidden bg-black/40"
              onMouseDown={handleMouseDown}
              style={{ cursor: imageUrl ? (dragging ? 'grabbing' : 'grab') : 'default' }}
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="Scoreboard reference"
                  draggable={false}
                  className="absolute left-1/2 top-1/2 max-h-none max-w-none select-none pointer-events-none"
                  style={{
                    transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
                  }}
                />
              ) : (
                <p className="flex h-full items-center justify-center text-sm text-slate-500">No image uploaded</p>
              )}
            </div>
          </div>

          <div className="flex flex-1 flex-col overflow-hidden lg:w-1/2">
            <div className="flex-1 overflow-y-auto p-4">
              <p className="mb-3 text-xs text-slate-500">
                Input by placement rank. #1 = Booyah. Points calculated live.
              </p>
              <div className="space-y-2">
                {rows.map((row, idx) => {
                  const livePts = row.teamId || row.teamName
                    ? calcSingleRowPoints(
                        row.placement,
                        inputMode === 'cr_league' ? (parseInt(row.totalScore, 10) || 0) : (parseInt(row.kills, 10) || 0),
                        inputMode,
                        scoringRules
                      )
                    : 0;

                  const rankBadge = row.placement === 1 ? 'BOOYAH 🔥' : `#${row.placement}`;

                  return (
                    <div key={idx} className={`flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 ${
                      row.placement === 1 ? 'bg-gold/10 ring-1 ring-gold/20' :
                      row.placement === 2 ? 'bg-slate-400/10' :
                      row.placement === 3 ? 'bg-amber-900/20' : 'bg-slate-800/40'
                    }`}>
                      <span className={`w-16 shrink-0 text-center text-xs font-bold ${
                        row.placement === 1 ? 'text-gold' : row.placement <= 3 ? 'text-slate-300' : 'text-slate-500'
                      }`}>{rankBadge}</span>
                      <select
                        value={row.teamId}
                        onChange={(e) => onTeamSelect(idx, e.target.value)}
                        className="min-w-[120px] flex-1 rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-sm text-white"
                      >
                        <option value="">Select Team</option>
                        {teams.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                      </select>
                      {inputMode === 'cr_league' ? (
                        <input
                          type="number"
                          placeholder="Score"
                          value={row.totalScore}
                          onChange={(e) => updateRow(idx, 'totalScore', e.target.value)}
                          className="w-16 rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 font-mono text-sm text-white"
                        />
                      ) : (
                        <input
                          type="number"
                          placeholder="Kills"
                          value={row.kills}
                          onChange={(e) => updateRow(idx, 'kills', e.target.value)}
                          className="w-16 rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 font-mono text-sm text-white"
                        />
                      )}
                      <span className="w-12 text-right font-mono text-sm font-bold text-emerald">{livePts || '-'}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-white/10 p-4">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button variant="success" onClick={() => onSubmit(filledRows)} loading={submitting} disabled={filledRows.length === 0}>
                Apply to Database
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
