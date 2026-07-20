import { useState, useCallback, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  UploadSimple,
  Scan,
  Check,
  Warning,
  Image as ImageIcon,
} from '@phosphor-icons/react';
import Button from '../components/Button';
import { useTournament } from '../context/TournamentContext';
import { cropScoreboard } from '../utils/canvasCropper';
import { scanMultipleImages, matchTeamsToRoster, terminateWorker } from '../utils/ocrScanner';
import { calcMatchPoints } from '../utils/pointsCalc';
import { api } from '../utils/api';

export default function MatchInput() {
  const { tournaments, activeTournament, selectTournament, refreshActive } = useTournament();
  const [selectedId, setSelectedId] = useState(activeTournament?._id || '');
  const [matchNumber, setMatchNumber] = useState(1);
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [scanStatus, setScanStatus] = useState(null);
  const [verifiedResults, setVerifiedResults] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (activeTournament?._id) setSelectedId(activeTournament._id);
  }, [activeTournament?._id]);

  useEffect(() => {
    if (selectedId) selectTournament(selectedId);
  }, [selectedId, selectTournament]);

  useEffect(() => {
    return () => { terminateWorker(); };
  }, []);

  const tournament = activeTournament;
  const teams = tournament?.teams || [];
  const matches = tournament?.matches || [];

  const handleFiles = useCallback((incoming) => {
    const accepted = Array.from(incoming).slice(0, 2);
    setFiles(accepted);
    setPreviews(accepted.map((f) => URL.createObjectURL(f)));
    setVerifiedResults([]);
    setScanStatus(null);
  }, []);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const runOCR = async () => {
    if (!files.length) return;
    setScanStatus({ phase: 'preprocessing', current: 0, total: files.length });

    try {
      const dataUrls = [];
      for (let i = 0; i < files.length; i++) {
        setScanStatus({ phase: 'cropping', current: i + 1, total: files.length });
        const { dataUrl } = await cropScoreboard(files[i]);
        dataUrls.push(dataUrl);
      }

      const results = await scanMultipleImages(dataUrls, setScanStatus);

      const allParsed = results.flatMap((r) => r.parsed);
      const matched = matchTeamsToRoster(allParsed, teams);

      setVerifiedResults(
        matched.map((r, i) => ({
          id: i,
          teamId: r.teamId,
          teamName: r.matchedTeamName,
          placement: r.placement,
          kills: r.kills,
          matchConfidence: r.matchConfidence,
        }))
      );

      await api.recordOcrScan(files.length);
    } catch (err) {
      setScanStatus({ phase: 'error', message: err.message });
    }
  };

  const updateResult = (id, field, value) => {
    setVerifiedResults((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const applyResults = async () => {
    if (!tournament || !verifiedResults.length) return;
    setSubmitting(true);
    try {
      const scored = calcMatchPoints(
        verifiedResults.map(({ teamId, teamName, placement, kills }) => ({
          teamId,
          teamName,
          placement: parseInt(placement, 10),
          kills: parseInt(kills, 10),
        }))
      );

      await api.submitMatchResults(tournament._id, {
        matchNumber,
        results: scored,
        ocrProcessed: true,
      });

      await refreshActive();
      setFiles([]);
      setPreviews([]);
      setVerifiedResults([]);
      setScanStatus(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white md:text-3xl">Input Match OCR</h1>
        <p className="mt-1 text-sm text-slate-400">
          Scan screenshot scoreboard Free Fire dengan Tesseract.js
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">Pilih Turnamen</label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-800/50 px-4 py-3 text-white focus:outline-none"
          >
            <option value="">-- Pilih turnamen --</option>
            {tournaments.map((t) => (
              <option key={t._id} value={t._id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">Match Number</label>
          <select
            value={matchNumber}
            onChange={(e) => setMatchNumber(parseInt(e.target.value, 10))}
            className="w-full rounded-xl border border-white/10 bg-slate-800/50 px-4 py-3 text-white focus:outline-none"
          >
            {matches.map((m) => (
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
          onDrop={onDrop}
          className={`glass-panel flex min-h-[280px] flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 transition ${
            dragOver ? 'border-emerald/50 bg-emerald/5' : 'border-white/10'
          }`}
        >
          <UploadSimple size={40} className="text-slate-500" weight="duotone" />
          <p className="mt-4 text-center text-sm font-medium text-white">
            Drag & drop screenshot scoreboard
          </p>
          <p className="mt-1 text-xs text-slate-500">Maksimal 2 screenshot per match (16:9)</p>
          <label className="mt-4 cursor-pointer">
            <span className="rounded-xl bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600">
              Pilih File
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />
          </label>

          {previews.length > 0 && (
            <div className="mt-6 flex gap-3">
              {previews.map((src, i) => (
                <div key={i} className="relative overflow-hidden rounded-lg">
                  <img src={src} alt={`Preview ${i + 1}`} className="h-20 w-36 object-cover" />
                  <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 text-[10px] text-white">
                    {i + 1}/2
                  </span>
                </div>
              ))}
            </div>
          )}

          {files.length > 0 && (
            <Button className="mt-4" onClick={runOCR} loading={scanStatus?.phase === 'scanning'}>
              <Scan size={18} /> Mulai Scan OCR
            </Button>
          )}
        </div>

        <div className="glass-panel rounded-2xl p-6">
          <h3 className="mb-4 flex items-center gap-2 font-bold text-white">
            <ImageIcon size={18} /> Status Scanning
          </h3>

          {!scanStatus && (
            <p className="text-sm text-slate-500">Upload screenshot untuk memulai OCR</p>
          )}

          {scanStatus?.phase === 'cropping' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <p className="text-sm text-gold">
                Pre-processing {scanStatus.current}/{scanStatus.total}...
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full bg-gold transition-all"
                  style={{ width: `${(scanStatus.current / scanStatus.total) * 100}%` }}
                />
              </div>
            </motion.div>
          )}

          {scanStatus?.phase === 'scanning' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <p className="text-sm text-emerald">
                Scanning {scanStatus.current}/{scanStatus.total}...
                {scanStatus.progress != null && ` (${scanStatus.progress}%)`}
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full bg-emerald transition-all"
                  style={{
                    width: `${
                      ((scanStatus.current - 1) / scanStatus.total +
                        (scanStatus.progress || 0) / 100 / scanStatus.total) *
                      100
                    }%`,
                  }}
                />
              </div>
            </motion.div>
          )}

          {scanStatus?.phase === 'complete' && (
            <div className="flex items-center gap-2 text-emerald">
              <Check size={20} weight="bold" />
              <span className="text-sm font-medium">
                {scanStatus.total}/{scanStatus.total} complete
              </span>
            </div>
          )}

          {scanStatus?.phase === 'error' && (
            <div className="flex items-center gap-2 text-crimson">
              <Warning size={20} />
              <span className="text-sm">{scanStatus.message}</span>
            </div>
          )}
        </div>
      </div>

      {verifiedResults.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel overflow-hidden rounded-2xl"
        >
          <div className="border-b border-white/5 px-6 py-4">
            <h3 className="font-bold text-white">Verifikasi Hasil OCR</h3>
            <p className="text-xs text-slate-500">Sesuaikan data sebelum apply ke database</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3">Kills</th>
                  <th className="px-4 py-3">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {verifiedResults.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min="1"
                        max="12"
                        value={r.placement}
                        onChange={(e) => updateResult(r.id, 'placement', e.target.value)}
                        className="w-14 rounded-lg border border-white/10 bg-slate-800 px-2 py-1 font-mono text-white"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={r.teamId || ''}
                        onChange={(e) => {
                          const team = teams.find((t) => t._id === e.target.value);
                          updateResult(r.id, 'teamId', e.target.value);
                          if (team) updateResult(r.id, 'teamName', team.name);
                        }}
                        className="w-full min-w-[160px] rounded-lg border border-white/10 bg-slate-800 px-2 py-1 text-white"
                      >
                        <option value="">-- Pilih tim --</option>
                        {teams.map((t) => (
                          <option key={t._id} value={t._id}>{t.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min="0"
                        value={r.kills}
                        onChange={(e) => updateResult(r.id, 'kills', e.target.value)}
                        className="w-14 rounded-lg border border-white/10 bg-slate-800 px-2 py-1 font-mono text-white"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.matchConfidence >= 70
                            ? 'bg-emerald/20 text-emerald'
                            : r.matchConfidence >= 40
                              ? 'bg-gold/20 text-gold'
                              : 'bg-crimson/20 text-crimson'
                        }`}
                      >
                        {r.matchConfidence}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end px-6 py-4">
            <Button variant="success" onClick={applyResults} loading={submitting}>
              Apply ke Database
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
