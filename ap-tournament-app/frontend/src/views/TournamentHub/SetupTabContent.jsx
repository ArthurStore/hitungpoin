import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../utils/api';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import { MAPS, FORMATS } from '../../utils/pointsCalc';

export default function SetupTabContent({ isNew, tournament, refresh }) {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'info' });

  const [form, setForm] = useState({
    name: tournament?.name || '',
    logo: tournament?.logo || '',
    format: tournament?.format || 'One Day',
    inputMode: tournament?.inputMode || 'cr_biasa',
    totalMatches: tournament?.totalMatches || 6,
    targetPoints: tournament?.targetPoints || 80,
    matchConfigs: tournament?.matchConfigs || [],
    rosterText: '',
  });

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update('logo', reader.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!form.name?.trim()) {
      setToast({ message: 'Tournament name is required.', type: 'error' });
      return;
    }

    setSaving(true);
    setToast({ message: '', type: 'info' });

    try {
      const configs = Array.from({ length: form.totalMatches }, (_, i) => ({
        matchNumber: i + 1,
        map: form.matchConfigs[i]?.map || MAPS[i % MAPS.length],
      }));

      if (isNew) {
        const created = await api.createTournament({ ...form, matchConfigs: configs });
        setToast({ message: 'Tournament created successfully!', type: 'success' });
        setTimeout(() => navigate(`/tournament/${created._id}/teams`, { replace: true }), 600);
      } else {
        await api.updateTournament(tournament._id, { ...form, matchConfigs: configs });
        if (form.rosterText.trim()) {
          await api.updateTeams(tournament._id, { rosterText: form.rosterText });
        }
        await refresh?.();
        setToast({ message: 'Setup saved successfully!', type: 'success' });
      }
    } catch (err) {
      console.error('Save setup failed:', err);
      setToast({
        message: err.message || 'Failed to save. Check API connection.',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="glass-panel space-y-5 rounded-2xl p-6">
        <h2 className="font-bold text-white">{isNew ? 'Create Tournament' : 'Tournament Setup'}</h2>

        <div>
          <label className="mb-2 block text-sm text-slate-300">Tournament Name</label>
          <input value={form.name} onChange={(e) => update('name', e.target.value)} disabled={saving}
            className="w-full rounded-xl border border-white/10 bg-slate-800/50 px-4 py-3 text-white focus:outline-none disabled:opacity-60" />
        </div>

        <div>
          <label className="mb-2 block text-sm text-slate-300">Logo</label>
          <input type="file" accept="image/*" onChange={handleLogo} disabled={saving} className="text-sm text-slate-400" />
          {form.logo && <img src={form.logo} alt="" className="mt-2 h-16 w-16 rounded-lg object-cover" />}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm text-slate-300">Format</label>
            <select value={form.format} onChange={(e) => update('format', e.target.value)} disabled={saving}
              className="w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-white">
              {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-300">Total Matches (1-10+)</label>
            <input type="number" min={1} max={20} value={form.totalMatches} disabled={saving}
              onChange={(e) => update('totalMatches', parseInt(e.target.value, 10) || 1)}
              className="w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 font-mono text-white" />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm text-slate-300">Default Input Mode</label>
          <div className="flex gap-2">
            {[{ id: 'cr_biasa', label: 'CR Biasa' }, { id: 'cr_league', label: 'CR League' }].map((m) => (
              <button key={m.id} type="button" disabled={saving} onClick={() => update('inputMode', m.id)}
                className={`rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50 ${form.inputMode === m.id ? 'bg-emerald/20 text-emerald' : 'bg-slate-800 text-slate-400'}`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm text-slate-300">Map per Match</label>
          <div className="space-y-2">
            {Array.from({ length: form.totalMatches }, (_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-slate-800/40 px-3 py-2">
                <span className="w-16 font-mono text-xs text-gold">M{i + 1}</span>
                <select
                  disabled={saving}
                  value={form.matchConfigs[i]?.map || MAPS[i % MAPS.length]}
                  onChange={(e) => {
                    const mc = Array.from({ length: form.totalMatches }, (_, j) => ({
                      matchNumber: j + 1,
                      map: form.matchConfigs[j]?.map || MAPS[j % MAPS.length],
                    }));
                    mc[i] = { matchNumber: i + 1, map: e.target.value };
                    update('matchConfigs', mc);
                  }}
                  className="flex-1 rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-sm text-white"
                >
                  {MAPS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm text-slate-300">{isNew ? 'Initial Roster (optional)' : 'Update Roster'}</label>
          <textarea value={form.rosterText} onChange={(e) => update('rosterText', e.target.value)} rows={6} disabled={saving}
            placeholder="PKOK BUDAL | Player1 // Player2&#10;VIBES | Rep1"
            className="w-full rounded-xl border border-white/10 bg-slate-800/50 px-4 py-3 font-mono text-sm text-white" />
        </div>

        <Button variant="success" onClick={handleSave} loading={saving} disabled={!form.name?.trim() || saving}>
          {saving ? 'Saving...' : isNew ? 'Create Tournament' : 'Save Setup'}
        </Button>
      </div>

      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: '', type: 'info' })}
      />
    </>
  );
}
