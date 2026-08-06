import { useState, useCallback, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { UploadSimple, Scan, PencilSimple, ClockCounterClockwise, ArrowsClockwise } from '@phosphor-icons/react';
import Button from '../../components/Button';
import ProgressBar from '../../components/ProgressBar';
import TerminalLogs, { createLogEntry } from '../../components/TerminalLogs';
import Toast from '../../components/Toast';
import ManualInputModal from '../../components/ManualInputModal';
import { cropForMode } from '../../utils/canvasCrop';
import {
  scanMultiPass, matchTeamsToRoster, terminateWorker,
} from '../../utils/ocrScanner';
import { calcMatchPoints, getScoringRules, getDefaultPlacementPoints } from '../../utils/pointsCalc';
import { api, resolveAssetUrl } from '../../utils/api';

const MAX_SCREENSHOTS = 3;

async function blobUrlToDataUrl(url) {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function openManualFallback(setToast, setManualOpen, setStartStep, addLog, reason) {
  setToast({ message: reason || 'OCR gagal — beralih ke Manual Input', type: 'error' });
  addLog('Fail-safe: Manual Input modal opened.');
  setStartStep(3);
  setManualOpen(true);
}

export default function MatchInputTab() {
  const { tournament, refresh } = useOutletContext();
  const teams = tournament?.teams || [];
  const matches = tournament?.matches || [];
  const scoringRules = getScoringRules(tournament);

  const [inputMode, setInputMode] = useState(tournament?.inputMode || 'cr_biasa');
  const [matchNumber, setMatchNumber] = useState(1);
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [verifiedResults, setVerifiedResults] = useState([]);
  const [nicknames, setNicknames] = useState([]);
  const [teamGroups, setTeamGroups] = useState([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [startStep, setStartStep] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'info' });

  useEffect(() => () => { terminateWorker(); }, []);

  const addLog = useCallback((message) => {
    setLogs((prev) => [...prev, createLogEntry(message)]);
  }, []);

  const handleFiles = (incoming) => {
    const accepted = Array.from(incoming).slice(0, MAX_SCREENSHOTS);
    setPreviews((prev) => {
      prev.forEach((u) => { if (u.startsWith('blob:')) URL.revokeObjectURL(u); });
      return accepted.map((f) => URL.createObjectURL(f));
    });
    setFiles(accepted);
    setVerifiedResults([]);
    setNicknames([]);
    setTeamGroups([]);
    setLogs([]);
    setProgress(0);
    setManualOpen(false);
  };

  const openSavedMatch = (mn) => {
    const match = matches.find((m) => m.matchNumber === mn);
    if (!match || match.status !== 'verified') {
      setToast({ message: 'Match ini belum punya hasil tersimpan', type: 'error' });
      return;
    }
    setMatchNumber(mn);
    setInputMode(match.inputMode || inputMode);
    const rows = (match.results || []).map((r, i) => ({
      id: i,
      placement: r.placement,
      teamId: r.teamId || '',
      teamName: r.teamName,
      ocrNickname: r.ocrNickname || r.nickname || r.teamName,
      nickname: r.ocrNickname || r.nickname || r.teamName,
      kills: r.kills ?? 0,
      totalScore: r.totalScore ?? r.kills ?? 0,
      placementPoints: r.placementPoints,
      players: r.players || [],
      matchedTeamName: r.teamName,
    }));
    setVerifiedResults(rows);
    setNicknames(rows.map((r) => ({
      nickname: r.ocrNickname || r.teamName,
      kills: r.kills,
      hits: 1,
      placements: [r.placement],
    })));
    setTeamGroups(rows.map((r) => ({
      placement: r.placement,
      kills: r.kills,
      nicknames: (r.players || []).map((p) => p.nickname || p).filter(Boolean).length
        ? (r.players || []).map((p) => p.nickname || p).filter(Boolean)
        : [r.ocrNickname || r.teamName].filter(Boolean),
      players: r.players || [],
      teamId: r.teamId || '',
      teamName: r.teamName || '',
    })));
    const shots = (match.screenshots || []).map((s) => resolveAssetUrl(s) || s);
    setPreviews(shots);
    setFiles([]);
    setStartStep(3);
    setManualOpen(true);
    setToast({ message: `Edit Match ${mn} — hasil OCR/input sebelumnya dimuat`, type: 'success' });
  };

  const runOCR = async (opts = {}) => {
    const isRescan = !!opts.rescan;
    const hasFiles = files.length > 0;
    const hasPreviews = previews.length > 0;
    if (!hasFiles && !hasPreviews) {
      setToast({ message: 'Upload screenshot dulu sebelum OCR', type: 'error' });
      return;
    }

    setScanning(true);
    setVerifiedResults([]);
    setNicknames([]);
    setTeamGroups([]);
    setLogs([]);
    setProgress(0);
    setManualOpen(false);

    try {
      addLog(`Mode: ${inputMode === 'cr_league' ? 'CR League' : 'CR Biasa'}`);
      addLog(isRescan ? 'Re-scan OCR dari gambar yang sama…' : 'Gemini Vision multi-pass OCR…');

      const dataUrls = [];
      if (hasFiles) {
        addLog(`Pre-processing ${files.length} file(s)…`);
        for (let i = 0; i < files.length; i += 1) {
          addLog(`Crop screenshot ${i + 1}/${files.length}...`);
          const { primary } = await cropForMode(files[i], inputMode);
          dataUrls.push(primary);
        }
      } else {
        // Re-scan dari preview tersimpan (data URL / resolved URL)
        addLog(`Re-scan ${previews.length} gambar tersimpan…`);
        for (let i = 0; i < previews.length; i += 1) {
          dataUrls.push(previews[i]);
        }
      }

      const result = await scanMultiPass(
        dataUrls,
        inputMode,
        (msg) => addLog(msg),
        (pct) => setProgress(pct)
      );

      if (!result.success || !result.entries?.length) {
        openManualFallback(
          setToast, setManualOpen, setStartStep, addLog,
          result.error || 'OCR gagal — gunakan Manual Input'
        );
        return;
      }

      const matched = matchTeamsToRoster(result.entries, teams).map((r, i) => ({
        ...r,
        id: i,
        ocrNickname: (r.players || []).map((p) => p.nickname || p).filter(Boolean).join(' · ')
          || r.nickname || r.teamName,
        players: r.players || [],
        placementPoints: getDefaultPlacementPoints(r.placement, scoringRules)
          + (r.placement === 1 ? (scoringRules.booyahBonus || 0) : 0),
        totalScore: inputMode === 'cr_league' ? (r.kills ?? r.totalScore ?? 0) : (r.totalScore ?? r.kills ?? 0),
      }));

      setVerifiedResults(matched);
      setNicknames(result.nicknames || []);
      setTeamGroups((result.teamGroups || []).map((g, i) => ({
        ...g,
        teamId: matched[i]?.teamId || '',
        teamName: matched[i]?.matchedTeamName || '',
      })));
      setStartStep(1);
      setManualOpen(true);
      setToast({
        message: isRescan
          ? `Re-scan selesai (${dataUrls.length} gambar). Verifikasi lagi.`
          : `OCR selesai (${dataUrls.length} pass). Verifikasi roster → skor.`,
        type: 'success',
      });
      setProgress(100);
    } catch (err) {
      addLog(`ERROR: ${err.message}`);
      openManualFallback(setToast, setManualOpen, setStartStep, addLog, err.message);
    } finally {
      setScanning(false);
    }
  };

  const applyResults = async (manualRows) => {
    const source = manualRows || verifiedResults;
    if (!source.length) return;

    setSubmitting(true);
    try {
      const payload = source
        .filter((r) => r.teamId || r.teamName)
        .map((r) => {
          const kills = parseInt(r.kills, 10) || 0;
          const totalScore = inputMode === 'cr_league'
            ? (parseInt(r.totalScore ?? r.totalPoints ?? r.kills, 10) || 0)
            : kills;
          return {
            teamId: r.teamId,
            teamName: r.teamName || teams.find((t) => t._id === r.teamId)?.name,
            placement: parseInt(r.placement, 10),
            kills: inputMode === 'cr_league' ? 0 : kills,
            totalScore,
            placementPoints: r.placementPoints != null ? parseInt(r.placementPoints, 10) : undefined,
            totalPoints: inputMode === 'cr_league' ? totalScore : r.totalPoints,
            ocrNickname: r.ocrNickname || r.nickname || '',
            players: r.players || [],
          };
        });

      const scored = calcMatchPoints(payload, inputMode, scoringRules).map((row, i) => {
        const src = payload[i];
        if (inputMode === 'cr_league') {
          return {
            ...row,
            kills: 0,
            killPoints: 0,
            placementPoints: 0,
            totalScore: src.totalScore,
            totalPoints: src.totalScore,
            ocrNickname: src.ocrNickname,
            players: src.players,
            mode: 'cr_league',
          };
        }
        const killPt = scoringRules.killPoint ?? 1;
        const pp = src.placementPoints != null ? src.placementPoints : row.placementPoints;
        const kp = (src.kills || 0) * killPt;
        return {
          ...row,
          placementPoints: pp,
          killPoints: kp,
          totalPoints: src.totalPoints != null ? src.totalPoints : (pp + kp),
          ocrNickname: src.ocrNickname,
          players: src.players,
        };
      });

      let screenshots = [];
      try {
        screenshots = (await Promise.all(previews.map((p) => blobUrlToDataUrl(p)))).filter(Boolean).slice(0, 3);
      } catch {
        screenshots = [];
      }

      await api.submitMatchResults(tournament._id, {
        matchNumber,
        results: scored,
        inputMode,
        ocrProcessed: verifiedResults.length > 0,
        screenshots,
      });

      // Dual-sync: merge OCR nicknames into Master Team roster (up to 6)
      for (const row of scored) {
        const name = row.teamName || teams.find((t) => t._id === row.teamId)?.name;
        if (!name) continue;
        let nicks = (row.players || [])
          .map((p) => (typeof p === 'string' ? p : p.nickname))
          .filter(Boolean);
        if (!nicks.length && row.ocrNickname) {
          nicks = String(row.ocrNickname).split(/[·|,]/).map((s) => s.trim()).filter(Boolean);
        }
        if (!nicks.length) continue;
        try {
          await api.upsertTeam(tournament._id, {
            teamId: row.teamId || undefined,
            name,
            players: nicks.map((n) => ({ nickname: n })),
            merge: true,
          });
        } catch { /* non-fatal */ }
      }

      if (!verifiedResults.length) {
        try { await api.recordManualScan(); } catch { /* ignore */ }
      }
      await refresh();
      setFiles([]);
      setPreviews((prev) => { prev.forEach((u) => { if (u.startsWith('blob:')) URL.revokeObjectURL(u); }); return []; });
      setVerifiedResults([]);
      setNicknames([]);
      setTeamGroups([]);
      setManualOpen(false);

      // Auto-advance ke match berikutnya
      const total = tournament.totalMatches || matches.length || 6;
      const savedNo = matchNumber;
      const nextNo = savedNo < total ? savedNo + 1 : savedNo;
      if (nextNo !== savedNo) setMatchNumber(nextNo);
      setToast({
        message: nextNo !== savedNo
          ? `Match ${savedNo} tersimpan! Lanjut ke Match ${nextNo}`
          : `Match ${savedNo} tersimpan ke leaderboard!`,
        type: 'success',
      });
    } catch (err) {
      setToast({ message: `Gagal Submit: ${err.message}`, type: 'error' });
      throw err; // biarkan modal tetap di Step 3 + tampilkan error
    } finally {
      setSubmitting(false);
    }
  };

  const manualInitialRows = verifiedResults.length > 0
    ? verifiedResults.map((r) => ({
        placement: r.placement,
        teamId: r.teamId || '',
        teamName: r.matchedTeamName || r.teamName,
        ocrNickname: r.ocrNickname || r.nickname || r.teamName,
        kills: r.kills ?? '',
        totalScore: r.totalScore ?? '',
        placementPoints: r.placementPoints,
        nickname: r.nickname || r.teamName,
        players: r.players || [],
      }))
    : undefined;

  const currentMatch = matches.find((m) => m.matchNumber === matchNumber);

  return (
    <div className="space-y-6">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />

      <ManualInputModal
        open={manualOpen}
        onClose={async () => {
          setManualOpen(false);
          // Hard refresh master teams only after modal closed
          try { await refresh(); } catch { /* ignore */ }
        }}
        imageUrls={previews}
        teams={teams}
        tournament={tournament}
        inputMode={inputMode}
        initialRows={manualInitialRows}
        nicknames={nicknames}
        teamGroups={teamGroups}
        startStep={startStep}
        onSubmit={applyResults}
        submitting={submitting}
        onTeamsUpdated={async (_team, opts) => {
          // Soft: jangan full refresh saat modal terbuka (itu yang reset dropdown)
          if (opts?.soft) return;
          try { await refresh(); } catch { /* ignore */ }
        }}
      />

      <div className="glass-panel rounded-2xl p-6">
        <h2 className="mb-4 font-bold text-white light:text-slate-900">Input Match Results</h2>

        <div className="mb-4">
          <label className="mb-2 block text-sm text-slate-300">Input Mode</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setInputMode('cr_biasa')}
              className={`flex-1 rounded-xl px-4 py-3 text-left text-sm ${inputMode === 'cr_biasa' ? 'bg-cyan-600/20 text-cyan-400 ring-1 ring-cyan-500/30' : 'bg-slate-800 text-slate-400'}`}>
              <p className="font-semibold">CR Biasa</p>
              <p className="text-xs opacity-70">Full scoreboard / match history</p>
            </button>
            <button type="button" onClick={() => setInputMode('cr_league')}
              className={`flex-1 rounded-xl px-4 py-3 text-left text-sm ${inputMode === 'cr_league' ? 'bg-emerald/20 text-emerald ring-1 ring-emerald/30' : 'bg-slate-800 text-slate-400'}`}>
              <p className="font-semibold">CR League / Ranklist</p>
              <p className="text-xs opacity-70">Rank | Team | Score</p>
            </button>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm text-slate-300">Match Number</label>
          <div className="flex flex-wrap gap-2">
            <select value={matchNumber} onChange={(e) => setMatchNumber(parseInt(e.target.value, 10))}
              className="min-w-[200px] flex-1 rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-white">
              {(matches.length ? matches : [{ matchNumber: 1, map: 'Bermuda' }]).map((m) => (
                <option key={m.matchNumber} value={m.matchNumber}>
                  Match {m.matchNumber} - {m.map} {m.status === 'verified' ? '(Done)' : ''}
                </option>
              ))}
            </select>
            {currentMatch?.status === 'verified' && (
              <Button variant="secondary" onClick={() => openSavedMatch(matchNumber)}>
                <ClockCounterClockwise size={16} /> Edit Hasil Match {matchNumber}
              </Button>
            )}
          </div>
          {currentMatch?.status === 'verified' && (
            <p className="mt-2 text-xs text-slate-500">
              Match sudah tersimpan. Klik &quot;Edit Hasil&quot; untuk buka ulang hasil OCR + screenshot tanpa scan ulang.
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          className={`glass-panel flex min-h-[260px] flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 ${dragOver ? 'border-emerald/50' : 'border-white/10'}`}
        >
          <UploadSimple size={36} className="text-slate-500" />
          <p className="mt-3 text-sm font-medium text-white">Upload hingga 3 screenshot</p>
          <p className="text-xs text-slate-500">Multi-pass OCR · Match history / scoreboard</p>
          <label className="mt-3 cursor-pointer rounded-xl bg-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-600">
            Pilih File (max {MAX_SCREENSHOTS})
            <input type="file" accept="image/*" multiple onChange={(e) => handleFiles(e.target.files)} className="hidden" />
          </label>
          {previews.length > 0 && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {previews.map((src, i) => (
                <div key={i} className="relative">
                  <img src={src} alt="" className="h-16 w-28 rounded object-cover ring-1 ring-white/10" />
                  <span className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 text-[9px] font-bold text-emerald">SS{i + 1}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {files.length > 0 && (
              <Button onClick={() => runOCR()} loading={scanning} disabled={scanning}>
                <Scan size={18} /> Scan {files.length} Screenshot{files.length > 1 ? 's' : ''}
              </Button>
            )}
            {(files.length > 0 || previews.length > 0) && (
              <Button
                variant="secondary"
                onClick={() => runOCR({ rescan: true })}
                loading={scanning}
                disabled={scanning}
              >
                <ArrowsClockwise size={18} /> OCR Ulang / Re-scan
              </Button>
            )}
            <Button variant="ghost" onClick={() => { setStartStep(3); setManualOpen(true); }}>
              <PencilSimple size={18} /> Use Manual Input
            </Button>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6">
          <h3 className="mb-3 font-bold text-white">Scan Progress & Logs</h3>
          <ProgressBar value={progress} className="mb-3" />
          <p className="mb-3 font-mono text-xs text-emerald">
            {scanning ? `Scanning... ${progress}%` : progress === 100 ? 'Complete — verify in modal' : 'Idle'}
          </p>
          <TerminalLogs logs={logs} />
        </div>
      </div>
    </div>
  );
}
