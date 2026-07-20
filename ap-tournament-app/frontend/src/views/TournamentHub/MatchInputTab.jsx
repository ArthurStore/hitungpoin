import { useState, useCallback, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { UploadSimple, Scan, PencilSimple } from '@phosphor-icons/react';
import Button from '../../components/Button';
import ProgressBar from '../../components/ProgressBar';
import TerminalLogs, { createLogEntry } from '../../components/TerminalLogs';
import Toast from '../../components/Toast';
import ManualInputModal from '../../components/ManualInputModal';
import { cropForMode } from '../../utils/canvasCrop';
import {
  scanWithLogs, parseByMode, matchTeamsToRoster, terminateWorker,
} from '../../utils/ocrScanner';
import { calcMatchPoints, getScoringRules } from '../../utils/pointsCalc';
import { api } from '../../utils/api';

function openManualFallback(setToast, setManualOpen, addLog, reason) {
  setToast({ message: reason || 'OCR failed or slow, switching to Manual Input', type: 'error' });
  addLog('Fallback: Manual Input modal opened.');
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
  const [manualOpen, setManualOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'info' });

  useEffect(() => () => { terminateWorker(); }, []);

  const addLog = useCallback((message) => {
    setLogs((prev) => [...prev, createLogEntry(message)]);
  }, []);

  const handleFiles = (incoming) => {
    const accepted = Array.from(incoming).slice(0, 2);
    setFiles(accepted);
    setPreviews(accepted.map((f) => URL.createObjectURL(f)));
    setVerifiedResults([]);
    setLogs([]);
    setProgress(0);
    setManualOpen(false);
  };

  const runOCR = async () => {
    if (!files.length) return;
    setScanning(true);
    setVerifiedResults([]);
    setLogs([]);
    setProgress(0);
    setManualOpen(false);

    try {
      addLog(`Mode: ${inputMode === 'cr_league' ? 'CR League' : 'CR Biasa'}`);
      addLog('Pre-processing screenshot...');

      const { primary } = await cropForMode(files[0], inputMode);
      addLog('Starting OCR (single optimized crop)...');

      const result = await scanWithLogs(
        primary,
        (msg) => addLog(msg),
        (pct) => setProgress(pct)
      );

      if (!result.success) {
        openManualFallback(setToast, setManualOpen, addLog, 'OCR failed or slow, switching to Manual Input');
        return;
      }

      addLog('Parsing results...');
      const parsed = parseByMode(result.text, inputMode);

      if (parsed.length === 0) {
        openManualFallback(setToast, setManualOpen, addLog, 'No data parsed. Switching to Manual Input');
        return;
      }

      addLog(`Parsed ${parsed.length} entries.`);

      if (inputMode === 'cr_league') {
        const direct = parsed.map((r, i) => ({
          id: i, teamId: null, teamName: r.teamName,
          placement: r.placement || r.rank,
          totalScore: r.totalScore || r.score, kills: 0, matchConfidence: 0,
        }));
        setVerifiedResults(matchTeamsToRoster(direct, teams).map((r, i) => ({ ...r, id: i })));
        setManualOpen(true);
      } else {
        setVerifiedResults(matchTeamsToRoster(parsed, teams).map((r, i) => ({ ...r, id: i })));
        setManualOpen(true);
      }

      await api.recordOcrScan(1);
      setToast({ message: 'OCR complete! Review results in Manual Input.', type: 'success' });
      setProgress(100);
    } catch (err) {
      addLog(`ERROR: ${err.message}`);
      openManualFallback(setToast, setManualOpen, addLog, err.message);
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
        .map((r) => ({
          teamId: r.teamId,
          teamName: r.teamName || teams.find((t) => t._id === r.teamId)?.name,
          placement: parseInt(r.placement, 10),
          kills: parseInt(r.kills, 10) || 0,
          totalScore: parseInt(r.totalScore, 10) || 0,
        }));

      const scored = calcMatchPoints(payload, inputMode, scoringRules);
      await api.submitMatchResults(tournament._id, {
        matchNumber,
        results: scored,
        inputMode,
        ocrProcessed: verifiedResults.length > 0,
      });
      await refresh();
      setFiles([]);
      setPreviews([]);
      setVerifiedResults([]);
      setManualOpen(false);
      setToast({ message: 'Match results saved!', type: 'success' });
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const manualInitialRows = verifiedResults.length > 0
    ? verifiedResults.map((r) => ({
        placement: r.placement,
        teamId: r.teamId || '',
        teamName: r.teamName,
        kills: r.kills ?? '',
        totalScore: r.totalScore ?? '',
      }))
    : undefined;

  return (
    <div className="space-y-6">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />

      <ManualInputModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        imageUrl={previews[0]}
        teams={teams}
        inputMode={inputMode}
        tournament={tournament}
        initialRows={manualInitialRows}
        onSubmit={applyResults}
        submitting={submitting}
      />

      <div className="glass-panel rounded-2xl p-6">
        <h2 className="mb-4 font-bold text-white">Input Match Results</h2>

        <div className="mb-4">
          <label className="mb-2 block text-sm text-slate-300">Input Mode</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setInputMode('cr_biasa')}
              className={`flex-1 rounded-xl px-4 py-3 text-left text-sm ${inputMode === 'cr_biasa' ? 'bg-crimson/20 text-crimson ring-1 ring-crimson/30' : 'bg-slate-800 text-slate-400'}`}>
              <p className="font-semibold">CR Biasa</p>
              <p className="text-xs opacity-70">Full scoreboard, rep verification</p>
            </button>
            <button type="button" onClick={() => setInputMode('cr_league')}
              className={`flex-1 rounded-xl px-4 py-3 text-left text-sm ${inputMode === 'cr_league' ? 'bg-emerald/20 text-emerald ring-1 ring-emerald/30' : 'bg-slate-800 text-slate-400'}`}>
              <p className="font-semibold">CR League / Ranklist</p>
              <p className="text-xs opacity-70">Rank | Team | Score - Langsung Jeder</p>
            </button>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm text-slate-300">Match Number</label>
          <select value={matchNumber} onChange={(e) => setMatchNumber(parseInt(e.target.value, 10))}
            className="w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-white">
            {(matches.length ? matches : [{ matchNumber: 1, map: 'Bermuda' }]).map((m) => (
              <option key={m.matchNumber} value={m.matchNumber}>
                Match {m.matchNumber} - {m.map} {m.status === 'verified' ? '(Done)' : ''}
              </option>
            ))}
          </select>
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
          <p className="mt-3 text-sm font-medium text-white">Drag & drop scoreboard screenshot</p>
          <p className="text-xs text-slate-500">Max 2 images | 16:9 widescreen</p>
          <label className="mt-3 cursor-pointer rounded-xl bg-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-600">
            Pilih File
            <input type="file" accept="image/*" multiple onChange={(e) => handleFiles(e.target.files)} className="hidden" />
          </label>
          {previews.length > 0 && (
            <div className="mt-4 flex gap-2">
              {previews.map((src, i) => (
                <img key={i} src={src} alt="" className="h-16 w-28 rounded object-cover" />
              ))}
            </div>
          )}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {files.length > 0 && (
              <Button onClick={runOCR} loading={scanning} disabled={scanning}>
                <Scan size={18} /> Mulai Scan OCR
              </Button>
            )}
            <Button variant="ghost" onClick={() => setManualOpen(true)}>
              <PencilSimple size={18} /> Use Manual Input
            </Button>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6">
          <h3 className="mb-3 font-bold text-white">Scan Progress & Logs</h3>
          <ProgressBar value={progress} className="mb-3" />
          <p className="mb-3 font-mono text-xs text-emerald">
            {scanning ? `Scanning... ${progress}%` : progress === 100 ? 'Complete' : 'Idle'}
          </p>
          <TerminalLogs logs={logs} />
        </div>
      </div>
    </div>
  );
}
