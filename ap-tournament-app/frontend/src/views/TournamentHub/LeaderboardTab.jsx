import { useEffect, useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Download, Broadcast, PencilSimple } from '@phosphor-icons/react';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import OfficialLeaderboard from '../../components/OfficialLeaderboard';
import { exportElementAsPNG } from '../../utils/exportUtils';
import { api } from '../../utils/api';
import { calcMatchPoints, getScoringRules, aggregateStandingsWithMatches } from '../../utils/pointsCalc';

export default function LeaderboardTab() {
  const { tournament, refresh } = useOutletContext();
  const [standings, setStandings] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'info' });
  const [editTarget, setEditTarget] = useState(null); // { team, matchNo, values }
  const boardRef = useRef(null);
  const scoringRules = getScoringRules(tournament);
  const mode = tournament?.inputMode || 'cr_biasa';

  const reload = async () => {
    const [lb, t] = await Promise.all([
      api.getLeaderboard(tournament._id),
      api.getTournament(tournament._id),
    ]);
    setStandings(lb.standings || []);
    setMatches(t.matches || []);
  };

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [tournament._id]);

  const handleExport = async () => {
    if (!boardRef.current) return;
    setExporting(true);
    try {
      await exportElementAsPNG(boardRef.current, `leaderboard-${tournament.name}.png`);
    } finally {
      setExporting(false);
    }
  };

  const handleRenameTeam = async (team, nextName) => {
    if (!team?.teamId) throw new Error('Team ID missing');
    await api.renameTeam(tournament._id, team.teamId, nextName);
    await reload();
    await refresh?.();
    setToast({ message: `Nama tim diubah → ${nextName}`, type: 'success' });
  };

  const openEdit = (team, matchNo) => {
    const match = matches.find((m) => m.matchNumber === matchNo);
    const result = (match?.results || []).find(
      (r) => String(r.teamId) === String(team.teamId) || r.teamName === team.teamName
    );
    const bd = team.matchBreakdown?.[matchNo] || {};
    setEditTarget({
      team,
      matchNo,
      placementPoints: result?.placementPoints ?? bd.placementPoints ?? 0,
      killPoints: result?.killPoints ?? bd.killPoints ?? 0,
      kills: result?.kills ?? bd.kills ?? 0,
      totalPoints: result?.totalPoints ?? bd.totalPoints ?? team.matchScores?.[matchNo] ?? 0,
      placement: result?.placement || 12,
    });
  };

  const saveInlineEdit = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      const { team, matchNo } = editTarget;
      const match = matches.find((m) => m.matchNumber === matchNo);
      if (!match) throw new Error('Match belum ada data');

      const nextResults = [...(match.results || [])];
      const idx = nextResults.findIndex(
        (r) => String(r.teamId) === String(team.teamId) || r.teamName === team.teamName
      );

      let row;
      if (mode === 'cr_league') {
        row = {
          teamId: team.teamId,
          teamName: team.teamName,
          placement: editTarget.placement,
          kills: 0,
          totalScore: parseInt(editTarget.totalPoints, 10) || 0,
          totalPoints: parseInt(editTarget.totalPoints, 10) || 0,
          placementPoints: 0,
          killPoints: 0,
          mode: 'cr_league',
        };
      } else {
        const kills = parseInt(editTarget.kills, 10) || 0;
        const placementPoints = parseInt(editTarget.placementPoints, 10) || 0;
        const killPt = scoringRules.killPoint ?? 1;
        const killPoints = kills * killPt;
        const totalPoints = placementPoints + killPoints;
        row = {
          teamId: team.teamId,
          teamName: team.teamName,
          placement: editTarget.placement,
          kills,
          placementPoints,
          killPoints,
          totalPoints,
          totalScore: kills,
          mode: 'cr_biasa',
        };
      }

      if (idx >= 0) nextResults[idx] = { ...nextResults[idx], ...row };
      else nextResults.push(row);

      const scored = calcMatchPoints(nextResults, mode, scoringRules);
      await api.submitMatchResults(tournament._id, {
        matchNumber: matchNo,
        results: scored,
        inputMode: mode,
        ocrProcessed: !!match.ocrProcessed,
        screenshots: match.screenshots || [],
      });

      await reload();
      await refresh?.();
      setEditTarget(null);
      setToast({ message: `M${matchNo} diupdate — klasemen dihitung ulang`, type: 'success' });
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const overlayUrl = `${window.location.origin}/overlay/${tournament._id}`;
  const slug = String(tournament.name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || String(tournament._id);
  const slugUrl = `${window.location.origin}/overlay/${slug}`;

  const copyText = async (text, successMsg) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setToast({ message: successMsg, type: 'success' });
    } catch {
      setToast({ message: 'Gagal menyalin — salin manual: ' + text, type: 'error' });
    }
  };

  if (loading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-slate-800" />;
  }

  return (
    <div className="space-y-6">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-white light:text-slate-900">Live Leaderboard</h2>
          <p className="text-xs text-slate-500">
            Format 9:16 · 15 tim · klik sel M1–Mn untuk edit inline
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => window.open(`/overlay/${tournament._id}`, '_blank')}>
            <Broadcast size={16} /> OBS Overlay
          </Button>
          <Button variant="ghost" onClick={() => copyText(overlayUrl, 'Overlay URL berhasil disalin!')}>
            Copy Overlay URL
          </Button>
          <Button variant="ghost" onClick={() => copyText(slugUrl, 'Slug URL berhasil disalin!')}>
            Copy Slug URL
          </Button>
          <Button variant="gold" onClick={handleExport} loading={exporting}>
            <Download size={16} /> Download PNG
          </Button>
        </div>
      </div>

      <OfficialLeaderboard
        boardRef={boardRef}
        tournament={tournament}
        standings={standings}
        matches={matches}
        editable
        onEditMatchScore={openEdit}
        onRenameTeam={handleRenameTeam}
      />

      {/* Editable table mirror for desktop clarity */}
      <div className="glass-panel overflow-x-auto rounded-2xl p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <PencilSimple size={16} className="text-gold" />
          Inline Editor · klik angka untuk ubah
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Mode: {mode === 'cr_league' ? 'CR League (Total Score)' : 'CR Biasa (Place Pts | Kill Pts)'}
          {' · '}Total / rank otomatis dihitung ulang setelah save.
        </p>
        <div className="text-xs text-slate-400">
          Preview lokal: {aggregateStandingsWithMatches(matches, tournament.teams || []).length} tim teragregasi
        </div>
      </div>

      {editTarget && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <h3 className="font-bold text-white">
              Edit {editTarget.team.teamName} · Match {editTarget.matchNo}
            </h3>
            <div className="mt-4 space-y-3">
              {mode === 'cr_league' ? (
                <label className="block text-xs text-slate-400">
                  Total Score
                  <input
                    type="number"
                    value={editTarget.totalPoints}
                    onChange={(e) => setEditTarget((t) => ({ ...t, totalPoints: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 font-mono text-white"
                  />
                </label>
              ) : (
                <>
                  <label className="block text-xs text-slate-400">
                    Placement Points
                    <input
                      type="number"
                      value={editTarget.placementPoints}
                      onChange={(e) => setEditTarget((t) => ({ ...t, placementPoints: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 font-mono text-white"
                    />
                  </label>
                  <label className="block text-xs text-slate-400">
                    Kills
                    <input
                      type="number"
                      value={editTarget.kills}
                      onChange={(e) => setEditTarget((t) => ({ ...t, kills: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2 font-mono text-white"
                    />
                  </label>
                  <p className="text-xs text-slate-500">
                    Kill Pts = kills × {scoringRules.killPoint ?? 1} · Total = Place + Kill
                  </p>
                </>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditTarget(null)}>Cancel</Button>
              <Button variant="secondary" onClick={saveInlineEdit} loading={saving}>Save & Recalc</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
