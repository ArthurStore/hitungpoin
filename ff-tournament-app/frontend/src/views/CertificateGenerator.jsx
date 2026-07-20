import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Certificate, Download, Medal } from '@phosphor-icons/react';
import Button from '../components/Button';
import { useTournament } from '../context/TournamentContext';
import { generateAllCertificates, downloadCertificate } from '../utils/certGenerator';
import { api } from '../utils/api';

export default function CertificateGenerator() {
  const { tournaments, activeTournament, selectTournament } = useTournament();
  const [selectedId, setSelectedId] = useState(activeTournament?._id || '');
  const [standings, setStandings] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeTournament?._id) setSelectedId(activeTournament._id);
  }, [activeTournament?._id]);

  useEffect(() => {
    if (!selectedId) return;
    selectTournament(selectedId);
    setLoading(true);
    api.getLeaderboard(selectedId)
      .then((data) => setStandings(data.standings || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedId, selectTournament]);

  const handleGenerate = async () => {
    if (!activeTournament || standings.length < 1) return;
    setGenerating(true);
    try {
      const certs = await generateAllCertificates(activeTournament, standings);
      setCertificates(certs);
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const rankColors = ['text-gold', 'text-slate-300', 'text-amber-700'];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white md:text-3xl">Generator Sertifikat</h1>
        <p className="mt-1 text-sm text-slate-400">
          Auto-generate sertifikat Juara 1, 2, dan 3
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-2 block text-sm font-medium text-slate-300">Turnamen</label>
          <select
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value);
              setCertificates([]);
            }}
            className="w-full rounded-xl border border-white/10 bg-slate-800/50 px-4 py-3 text-white focus:outline-none"
          >
            <option value="">-- Pilih turnamen --</option>
            {tournaments.map((t) => (
              <option key={t._id} value={t._id}>{t.name}</option>
            ))}
          </select>
        </div>
        <Button
          variant="gold"
          onClick={handleGenerate}
          loading={generating}
          disabled={!selectedId || standings.length < 1}
        >
          <Certificate size={18} /> Generate Sertifikat
        </Button>
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl bg-slate-800" />
          ))}
        </div>
      )}

      {!loading && standings.length > 0 && certificates.length === 0 && (
        <div className="glass-panel rounded-2xl p-8 text-center">
          <Medal size={48} className="mx-auto text-slate-600" weight="duotone" />
          <p className="mt-4 text-sm text-slate-400">
            Top 3: {standings.slice(0, 3).map((s) => s.teamName).join(', ')}
          </p>
          <p className="mt-1 text-xs text-slate-500">Klik Generate untuk membuat sertifikat</p>
        </div>
      )}

      {certificates.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {certificates.map((cert, i) => (
            <motion.div
              key={cert.rank}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-panel overflow-hidden rounded-2xl"
            >
              <div className="border-b border-white/5 px-4 py-3">
                <p className={`text-sm font-bold ${rankColors[i]}`}>
                  Juara {cert.rank} - {cert.teamName}
                </p>
              </div>
              <div className="p-3">
                <img
                  src={cert.dataUrl}
                  alt={`Sertifikat Juara ${cert.rank} - ${cert.teamName}`}
                  className="w-full rounded-lg"
                />
              </div>
              <div className="px-4 pb-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() =>
                    downloadCertificate(
                      cert.dataUrl,
                      `sertifikat-juara-${cert.rank}-${cert.teamName.replace(/\s+/g, '-').toLowerCase()}.png`
                    )
                  }
                >
                  <Download size={16} /> Download PNG
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {!loading && selectedId && standings.length === 0 && (
        <div className="glass-panel rounded-2xl p-8 text-center">
          <p className="text-sm text-slate-400">Belum ada data klasemen untuk turnamen ini.</p>
        </div>
      )}
    </div>
  );
}
