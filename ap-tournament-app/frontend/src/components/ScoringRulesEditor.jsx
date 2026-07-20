import { DEFAULT_PLACEMENT_POINTS, DEFAULT_KILL_POINT } from '../utils/pointsCalc';

const PLACEMENT_LABELS = {
  1: '#1 Booyah', 2: '#2', 3: '#3', 4: '#4', 5: '#5', 6: '#6',
  7: '#7', 8: '#8', 9: '#9', 10: '#10', 11: '#11', 12: '#12+',
};

export default function ScoringRulesEditor({ rules, onChange, disabled }) {
  const placement = rules?.placementPoints || { ...DEFAULT_PLACEMENT_POINTS };
  const killPoint = rules?.killPoint ?? DEFAULT_KILL_POINT;

  const updatePlacement = (rank, val) => {
    onChange({
      ...rules,
      placementPoints: { ...placement, [rank]: parseInt(val, 10) || 0 },
    });
  };

  return (
    <div className="space-y-4 rounded-xl border border-white/5 bg-slate-800/30 p-4">
      <h3 className="text-sm font-bold text-white">Custom Scoring Formula</h3>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {Object.entries(PLACEMENT_LABELS).map(([rank, label]) => (
          <div key={rank}>
            <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">{label}</label>
            <input
              type="number"
              min={0}
              disabled={disabled}
              value={placement[rank] ?? DEFAULT_PLACEMENT_POINTS[rank]}
              onChange={(e) => updatePlacement(rank, e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 font-mono text-sm text-white"
            />
          </div>
        ))}
      </div>

      <div className="max-w-xs">
        <label className="mb-1 block text-xs text-slate-400">Point per 1 Kill</label>
        <input
          type="number"
          min={0}
          step={0.5}
          disabled={disabled}
          value={killPoint}
          onChange={(e) => onChange({ ...rules, killPoint: parseFloat(e.target.value) || 0 })}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 font-mono text-white"
        />
      </div>
    </div>
  );
}
