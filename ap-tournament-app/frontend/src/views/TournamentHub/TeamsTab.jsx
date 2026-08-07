import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FloppyDisk, Plus } from '@phosphor-icons/react';
import { api } from '../../utils/api';
import Button from '../../components/Button';
import Toast from '../../components/Toast';

const NICK_SLOTS = 6;

function nicksFromTeam(team) {
  const list = (team.players || []).map((p) => p.nickname || p).filter(Boolean);
  return Array.from({ length: NICK_SLOTS }, (_, i) => list[i] || '');
}

export default function TeamsTab() {
  const { tournament, refresh } = useOutletContext();
  const [rosterText, setRosterText] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'info' });
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);

  const teams = tournament?.teams || [];

  useEffect(() => {
    const next = {};
    teams.forEach((t) => {
      next[t._id] = {
        name: t.name || '',
        nicks: nicksFromTeam(t),
      };
    });
    setDrafts(next);
  }, [teams]);

  const handleBulkSave = async () => {
    setBulkSaving(true);
    try {
      await api.updateTeams(tournament._id, { rosterText });
      await refresh();
      setToast({ message: 'Bulk roster tersimpan', type: 'success' });
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setBulkSaving(false);
    }
  };

  const updateDraft = (teamId, patch) => {
    setDrafts((prev) => ({
      ...prev,
      [teamId]: { ...prev[teamId], ...patch },
    }));
  };

  const updateNick = (teamId, idx, value) => {
    setDrafts((prev) => {
      const cur = prev[teamId] || { name: '', nicks: Array(NICK_SLOTS).fill('') };
      const nicks = [...(cur.nicks || Array(NICK_SLOTS).fill(''))];
      nicks[idx] = value;
      return { ...prev, [teamId]: { ...cur, nicks } };
    });
  };

  const saveTeam = async (team) => {
    const draft = drafts[team._id];
    if (!draft) return;
    const name = (draft.name || '').trim();
    if (!name) {
      setToast({ message: 'Nama tim tidak boleh kosong', type: 'error' });
      return;
    }
    const players = (draft.nicks || [])
      .map((n) => String(n || '').trim())
      .filter(Boolean)
      .slice(0, NICK_SLOTS)
      .map((nickname) => ({ nickname }));

    setSavingId(team._id);
    try {
      await api.upsertTeam(tournament._id, {
        teamId: team._id,
        name,
        players,
        representative: players[0]?.nickname || '',
        merge: false,
      });
      await refresh();
      setToast({ message: `Tim "${name}" tersinkron ke leaderboard & match`, type: 'success' });
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setSavingId(null);
    }
  };

  const addEmptyTeam = async () => {
    const name = `TIM ${teams.length + 1}`;
    try {
      await api.upsertTeam(tournament._id, {
        name,
        players: [],
        merge: false,
      });
      await refresh();
      setToast({ message: `Tim "${name}" ditambahkan — edit nama & nick di bawah`, type: 'success' });
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />

      <div className="glass-panel rounded-2xl p-6">
        <h2 className="mb-2 font-bold text-white">Teams & Roster</h2>
        <p className="mb-4 text-xs text-slate-500">
          Edit nama + Nick 1–6 di kartu di bawah (two-way sync ke match & leaderboard).
          Atau paste bulk format: Team | Nick1 // Nick2 // …
        </p>
        <textarea
          value={rosterText}
          onChange={(e) => setRosterText(e.target.value)}
          rows={5}
          placeholder={"EXC | EXC_A // EXC_B // EXC_C // EXC_D // EXC_SUB1\nVIBES | VibesX // Player2 // Player3 // Player4"}
          className="w-full rounded-xl border border-white/10 bg-slate-800/50 px-4 py-3 font-mono text-sm text-white"
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="success" onClick={handleBulkSave} loading={bulkSaving}>Save Bulk Roster</Button>
          <Button variant="secondary" onClick={addEmptyTeam}>
            <Plus size={16} /> Tambah Tim
          </Button>
        </div>
      </div>

      {teams.length > 0 && (
        <div className="glass-panel rounded-2xl p-6">
          <h3 className="mb-4 font-bold text-white">Edit Tim ({teams.length})</h3>
          <div className="grid gap-4 lg:grid-cols-2">
            {teams.map((t) => {
              const draft = drafts[t._id] || { name: t.name, nicks: nicksFromTeam(t) };
              return (
                <div key={t._id} className="rounded-xl border border-white/10 bg-slate-800/40 p-4">
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Nama Tim
                  </label>
                  <input
                    type="text"
                    value={draft.name}
                    onChange={(e) => updateDraft(t._id, { name: e.target.value })}
                    className="mb-3 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm font-semibold uppercase text-white outline-none focus:border-emerald/50"
                  />
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Nickname Player 1–6
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {(draft.nicks || Array(NICK_SLOTS).fill('')).map((nick, i) => (
                      <label key={i} className="block">
                        <span className={`mb-0.5 block text-[9px] ${i >= 4 ? 'text-amber-400/80' : 'text-cyan-400/70'}`}>
                          {i >= 4 ? `Cadangan ${i - 3}` : `Player ${i + 1}`}
                        </span>
                        <input
                          type="text"
                          value={nick}
                          onChange={(e) => updateNick(t._id, i, e.target.value)}
                          placeholder={`Nick ${i + 1}`}
                          className="w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 font-mono text-xs text-cyan-200 outline-none focus:border-cyan-400/40"
                        />
                      </label>
                    ))}
                  </div>
                  <Button
                    variant="success"
                    className="mt-3 w-full"
                    onClick={() => saveTeam(t)}
                    loading={savingId === t._id}
                  >
                    <FloppyDisk size={16} /> Simpan & Sync
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
