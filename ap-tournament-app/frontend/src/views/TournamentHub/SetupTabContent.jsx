import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../utils/api';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import LogoDropzone from '../../components/LogoDropzone';
import ScoringRulesEditor from '../../components/ScoringRulesEditor';
import {
  MAPS, FORMATS, MATCH_COUNT_OPTIONS,
  buildDefaultScoringRules, buildMatchConfigs,
} from '../../utils/pointsCalc';

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
    matchConfigs: tournament?.matchConfigs?.length
      ? tournament.matchConfigs
      : buildMatchConfigs(tournament?.totalMatches || 6),
    rosterText: '',
    scoringRules: tournament?.scoringRules || buildDefaultScoringRules(),
    leaderboardSubtitle: tournament?.leaderboardSubtitle || 'KLASEMEN GRAND FINAL',
  });

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleTotalMatchesChange = (count) => {
    setForm((p) => ({
      ...p,
      totalMatches: count,
      matchConfigs: buildMatchConfigs(count, p.matchConfigs),
    }));
  };

  const handleSave = async () => {
    if (!form.name?.trim()) {
      setToast({ message: 'Tournament name is required.', type: 'error' });
      return;
    }

    setSaving(true);
    setToast({ message: '', type: 'info' });

    try {
      const configs = buildMatchConfigs(form.totalMatches, form.matchConfigs);
      const payload = { ...form, matchConfigs: configs };

      if (isNew) {
        const created = await api.createTournament(payload);
        setToast({ message: 'Tournament created successfully!', type: 'success' });
        setTimeout(() => navigate(`/tournament/${created._id}/teams`, { replace: true }), 600);
      } else {
        await api.updateTournament(tournament._id, payload);
        if (form.rosterText.trim()) {
          await api.updateTeams(tournament._id, { rosterText: form.rosterText });
        }
        await refresh?.();
        setToast({ message: 'Setup saved successfully!', type: 'success' });
      }
    } catch (err) {
      console.error('Save setup failed:', err);
      setToast({ message: err.message || 'Failed to save.', type: 'error' });
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
          <label className="mb-2 block text-sm text-slate-300">Leaderboard Subtitle</label>
          <input
            value={form.leaderboardSubtitle}
            onChange={(e) => update('leaderboardSubtitle', e.target.value)}
            disabled={saving}
            placeholder="KLASEMEN GRAND FINAL"
            className="w-full rounded-xl border border-white/10 bg-slate-800/50 px-4 py-3 font-display text-white focus:outline-none disabled:opacity-60"
          />
          <p className="mt-1 text-xs text-slate-500">Shown on 9:16 poster export (e.g. DAY 1 - QUALIFIER)</p>
        </div>

        <div>
          <label className="mb-2 block text-sm text-slate-300">Event Logo</label>
          <LogoDropzone value={form.logo} onChange={(v) => update('logo', v)} disabled={saving} />
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
            <label className="mb-2 block text-sm text-slate-300">Total Matches</label>
            <select value={form.totalMatches} onChange={(e) => handleTotalMatchesChange(parseInt(e.target.value, 10))} disabled={saving}
              className="w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-white">
              {MATCH_COUNT_OPTIONS.map((n) => (
                <option key={n} value={n}>{n} Match{n > 1 ? 'es' : ''}</option>
              ))}
            </select>
          </div>
        </div>

        <ScoringRulesEditor
          rules={form.scoringRules}
          onChange={(r) => update('scoringRules', r)}
          disabled={saving}
        />

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
            {form.matchConfigs.map((mc, i) => (
              <div key={mc.matchNumber} className="flex items-center gap-3 rounded-lg bg-slate-800/40 px-3 py-2">
                <span className="w-16 font-mono text-xs text-gold">M{mc.matchNumber}</span>
                <select
                  disabled={saving}
                  value={mc.map}
                  onChange={(e) => {
                    const updated = form.matchConfigs.map((m, j) =>
                      j === i ? { ...m, map: e.target.value } : m
                    );
                    update('matchConfigs', updated);
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

      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />
    </>
  );
}
