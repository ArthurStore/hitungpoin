import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../utils/api';
import Button from '../../components/Button';

export default function TeamsTab() {
  const { tournament, refresh } = useOutletContext();
  const [rosterText, setRosterText] = useState('');
  const [saving, setSaving] = useState(false);

  const teams = tournament?.teams || [];

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateTeams(tournament._id, { rosterText });
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-2xl p-6">
        <h2 className="mb-2 font-bold text-white">Teams & Roster</h2>
        <p className="mb-4 text-xs text-slate-500">
          Format: Team Name | Nick1 // Nick2 // Nick3 // Nick4 // Nick5 // Nick6
          (maks. 6 nickname — termasuk cadangan). Roster juga ter-sync otomatis dari OCR Match.
        </p>
        <textarea
          value={rosterText}
          onChange={(e) => setRosterText(e.target.value)}
          rows={8}
          placeholder={"EXC | EXC_A // EXC_B // EXC_C // EXC_D // EXC_SUB1\nVIBES | VibesX // Player2 // Player3 // Player4"}
          className="w-full rounded-xl border border-white/10 bg-slate-800/50 px-4 py-3 font-mono text-sm text-white"
        />
        <Button variant="success" className="mt-4" onClick={handleSave} loading={saving}>Save Teams</Button>
      </div>

      {teams.length > 0 && (
        <div className="glass-panel rounded-2xl p-6">
          <h3 className="mb-4 font-bold text-white">Registered Teams ({teams.length})</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {teams.map((t) => {
              const nicks = (t.players || []).map((p) => p.nickname || p).filter(Boolean);
              return (
                <div key={t._id} className="rounded-xl bg-slate-800/40 px-4 py-3">
                  <p className="font-semibold text-white">{t.name}</p>
                  {nicks.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {nicks.map((n, i) => (
                        <span
                          key={i}
                          className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                            i >= 4 ? 'bg-amber-500/15 text-amber-300' : 'bg-cyan-500/15 text-cyan-300'
                          }`}
                          title={i >= 4 ? 'Cadangan' : 'Roster utama'}
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Rep: {t.representative || '-'}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
