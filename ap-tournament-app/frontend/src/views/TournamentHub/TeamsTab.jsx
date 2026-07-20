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
          Format: Team Name | Rep // Player2 // Player3 (1-n nicknames supported)
        </p>
        <textarea
          value={rosterText}
          onChange={(e) => setRosterText(e.target.value)}
          rows={8}
          placeholder="PKOK BUDAL | BudalPro&#10;VIBES | VibesX // Player2 // Player3 // Player4"
          className="w-full rounded-xl border border-white/10 bg-slate-800/50 px-4 py-3 font-mono text-sm text-white"
        />
        <Button variant="success" className="mt-4" onClick={handleSave} loading={saving}>Save Teams</Button>
      </div>

      {teams.length > 0 && (
        <div className="glass-panel rounded-2xl p-6">
          <h3 className="mb-4 font-bold text-white">Registered Teams ({teams.length})</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {teams.map((t) => (
              <div key={t._id} className="rounded-xl bg-slate-800/40 px-4 py-3">
                <p className="font-semibold text-white">{t.name}</p>
                <p className="text-xs text-slate-500">
                  Rep: {t.representative || t.players?.[0]?.nickname || '-'}
                  {t.players?.length > 1 && ` + ${t.players.length - 1} players`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
