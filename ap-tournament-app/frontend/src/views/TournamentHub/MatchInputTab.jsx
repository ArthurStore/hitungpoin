import { useState, useCallback, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { UploadSimple, Scan } from '@phosphor-icons/react';
import Button from '../../components/Button';
import ProgressBar from '../../components/ProgressBar';
import TerminalLogs, { createLogEntry } from '../../components/TerminalLogs';
import { cropForMode } from '../../utils/canvasCrop';
import {
  scanMultipleWithLogs, parseByMode, matchTeamsToRoster, terminateWorker,
} from '../../utils/ocrScanner';
import { calcMatchPoints } from '../../utils/pointsCalc';
import { api } from '../../utils/api';

export default function MatchInputTab() {
  const { tournament, refresh } = useOutletContext();
  const teams = tournament?.teams || [];
  const matches = tournament?.matches || [];

  const [inputMode, setInputMode] = useState(tournament?.inputMode || 'cr_biasa');
  const [matchNumber, setMatchNumber] = useState(1);
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [verifiedResults, setVerifiedResults] = useState([]);
  const [showManual, setShowManual] = useState(false);
  const [manualRows, setManualRows] = useState([{ placement: 1, teamName: '', kills: 0, totalScore: 0 }]);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

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
    setScanError(null);
    setShowManual(false);
  };

  const runOCR = async () => {
    if (!files.length) return;
    setScanning(true);
    setScanError(null);
    setShowManual(false);
    setLogs([]);
    setProgress(0);
    setVerifiedResults([]);

    try {
      addLog(`Mode: ${inputMode === 'cr_league' ? 'CR League / Ranklist' : 'CR Biasa'}`);
      addLog('Pre-processing screenshots with canvas crop...');

      const allDataUrls = [];
      for (let i = 0; i < files.length; i++) {
        addLog(`Cropping image ${i + 1}/${files.length}...`);
        const { primary, extras } = await cropForMode(files[i], inputMode);
        allDataUrls.push(primary, ...extras);
      }

      addLog(`Starting OCR on ${allDataUrls.length} crop region(s)...`);

      const scanResults = await scanMultipleWithLogs(
        allDataUrls,
        (msg) => addLog(msg),
        (pct) => setProgress(pct)
      );

      const failed = scanResults.find((r) => !r.success);
      if (failed) {
        setScanError(failed.error);
        setShowManual(true);
        addLog('Fallback: Manual Input form activated.');
        return;
      }

      const combinedText = scanResults.map((r) => r.text).join('\n');
      addLog('Parsing OCR results...');
      const parsed = parseByMode(combinedText, inputMode);

      if (parsed.length === 0) {
        setScanError('No data parsed from OCR. Try Manual Input.');
        setShowManual(true);
        addLog('ERROR: Parser returned 0 results. Manual Input activated.');
        return;
      }

      addLog(`Parsed ${parsed.length} team entries.`);

      if (inputMode === 'cr_league') {
        const direct = parsed.map((r, i) => ({
          id: i,
          teamId: null,
          teamName: r.teamName,
          placement: r.placement || r.rank,
          totalScore: r.totalScore || r.score,
          kills: 0,
          matchConfidence: 0,
        }));
        const matched = matchTeamsToRoster(direct, teams);
        setVerifiedResults(matched.map((r, i) => ({ ...r, id: i })));
        addLog('CR League: Langsung Jeder - ready for apply.');
      } else {
        const matched = matchTeamsToRoster(parsed, teams);
        setVerifiedResults(matched.map((r, i) => ({ ...r, id: i })));
        addLog('CR Biasa: Team verification ready.');
      }

      await api.recordOcrScan(files.length);
      addLog('Completed!');
      setProgress(100);
    } catch (err) {
      setScanError(err.message);
      addLog(`ERROR: ${err.message}`);
      setShowManual(true);
    } finally {
      setScanning(false);
    }
  };

  const applyResults = async () => {
    const source = showManual && verifiedResults.length === 0
      ? manualRows.filter((r) => r.teamName)
      : verifiedResults;

    if (!source.length) return;
    setSubmitting(true);
    try {
      const payload = source.map((r) => ({
        teamId: r.teamId,
        teamName: r.teamName || teams.find((t) => t._id === r.teamId)?.name,
        placement: parseInt(r.placement, 10),
        kills: parseInt(r.kills, 10) || 0,
        totalScore: parseInt(r.totalScore, 10) || 0,
        score: parseInt(r.totalScore, 10) || 0,
      }));

      const scored = calcMatchPoints(payload, inputMode);
      await api.submitMatchResults(tournament._id, {
        matchNumber,
        results: scored,
        inputMode,
        ocrProcessed: !showManual || verifiedResults.length > 0,
      });
      await refresh();
      setFiles([]);
      setPreviews([]);
      setVerifiedResults([]);
      setLogs([]);
      setShowManual(false);
      addLog('Results applied to database!');
    } catch (err) {
      addLog(`ERROR: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
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

        <div className="mb-4">
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
          className={`glass-panel flex min-h-[240px] flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 ${dragOver ? 'border-emerald/50' : 'border-white/10'}`}
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
          {files.length > 0 && (
            <Button className="mt-4" onClick={runOCR} loading={scanning} disabled={scanning}>
              <Scan size={18} /> Mulai Scan OCR
            </Button>
          )}
        </div>

        <div className="glass-panel rounded-2xl p-6">
          <h3 className="mb-3 font-bold text-white">Scan Progress & Logs</h3>
          <ProgressBar value={progress} className="mb-3" />
          <p className="mb-3 font-mono text-xs text-emerald">
            {scanning ? `Scanning... ${progress}%` : progress === 100 ? 'Scan complete' : 'Idle'}
          </p>
          <TerminalLogs logs={logs} />
        </div>
      </div>

      {scanError && !showManual && (
        <div className="rounded-xl border border-crimson/30 bg-crimson/10 px-4 py-3 text-sm text-crimson">
          {scanError}
        </div>
      )}

      {(showManual || verifiedResults.length > 0) && (
        <div className="glass-panel rounded-2xl p-6">
          <h3 className="mb-4 font-bold text-white">
            {verifiedResults.length > 0 ? 'Verifikasi Hasil OCR' : 'Manual Input Fallback'}
          </h3>

          {showManual && verifiedResults.length === 0 && (
            <div className="space-y-2">
              {manualRows.map((row, i) => (
                <div key={i} className="flex flex-wrap gap-2">
                  <input type="number" placeholder="Rank" value={row.placement}
                    onChange={(e) => { const r = [...manualRows]; r[i].placement = e.target.value; setManualRows(r); }}
                    className="w-16 rounded-lg border border-white/10 bg-slate-800 px-2 py-1.5 font-mono text-white" />
                  <select value={row.teamId || ''}
                    onChange={(e) => { const r = [...manualRows]; r[i].teamId = e.target.value; r[i].teamName = teams.find((t) => t._id === e.target.value)?.name || ''; setManualRows(r); }}
                    className="min-w-[140px] flex-1 rounded-lg border border-white/10 bg-slate-800 px-2 py-1.5 text-white">
                    <option value="">Team</option>
                    {teams.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                  </select>
                  {inputMode === 'cr_league' ? (
                    <input type="number" placeholder="Score" value={row.totalScore}
                      onChange={(e) => { const r = [...manualRows]; r[i].totalScore = e.target.value; setManualRows(r); }}
                      className="w-20 rounded-lg border border-white/10 bg-slate-800 px-2 py-1.5 font-mono text-white" />
                  ) : (
                    <input type="number" placeholder="Kills" value={row.kills}
                      onChange={(e) => { const r = [...manualRows]; r[i].kills = e.target.value; setManualRows(r); }}
                      className="w-20 rounded-lg border border-white/10 bg-slate-800 px-2 py-1.5 font-mono text-white" />
                  )}
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={() => setManualRows([...manualRows, { placement: manualRows.length + 1, teamName: '', kills: 0, totalScore: 0 }])}>
                + Add Row
              </Button>
            </div>
          )}

          {verifiedResults.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-500">
                    <th className="px-3 py-2">Rank</th>
                    <th className="px-3 py-2">Team</th>
                    <th className="px-3 py-2">{inputMode === 'cr_league' ? 'Score' : 'Kills'}</th>
                    {inputMode === 'cr_biasa' && <th className="px-3 py-2">Conf.</th>}
                  </tr>
                </thead>
                <tbody>
                  {verifiedResults.map((r) => (
                    <tr key={r.id} className="border-t border-white/5">
                      <td className="px-3 py-2">
                        <input type="number" value={r.placement} min={1} max={12}
                          onChange={(e) => setVerifiedResults((prev) => prev.map((x) => x.id === r.id ? { ...x, placement: e.target.value } : x))}
                          className="w-14 rounded border border-white/10 bg-slate-800 px-2 py-1 font-mono text-white" />
                      </td>
                      <td className="px-3 py-2">
                        <select value={r.teamId || ''}
                          onChange={(e) => {
                            const team = teams.find((t) => t._id === e.target.value);
                            setVerifiedResults((prev) => prev.map((x) => x.id === r.id ? { ...x, teamId: e.target.value, teamName: team?.name || x.teamName } : x));
                          }}
                          className="w-full min-w-[120px] rounded border border-white/10 bg-slate-800 px-2 py-1 text-white">
                          <option value="">Select</option>
                          {teams.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        {inputMode === 'cr_league' ? (
                          <input type="number" value={r.totalScore || ''}
                            onChange={(e) => setVerifiedResults((prev) => prev.map((x) => x.id === r.id ? { ...x, totalScore: e.target.value } : x))}
                            className="w-16 rounded border border-white/10 bg-slate-800 px-2 py-1 font-mono text-white" />
                        ) : (
                          <input type="number" value={r.kills}
                            onChange={(e) => setVerifiedResults((prev) => prev.map((x) => x.id === r.id ? { ...x, kills: e.target.value } : x))}
                            className="w-16 rounded border border-white/10 bg-slate-800 px-2 py-1 font-mono text-white" />
                        )}
                      </td>
                      {inputMode === 'cr_biasa' && (
                        <td className="px-3 py-2">
                          <span className={`text-xs ${r.matchConfidence >= 70 ? 'text-emerald' : 'text-gold'}`}>{r.matchConfidence}%</span>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <Button variant="success" onClick={applyResults} loading={submitting}>Apply to Database</Button>
          </div>
        </div>
      )}
    </div>
  );
}
