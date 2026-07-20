import { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { motion } from 'motion/react';
import { Download, Palette, Eye, EyeSlash } from '@phosphor-icons/react';
import Button from '../components/Button';
import { useTournament } from '../context/TournamentContext';
import { LEADERBOARD_THEMES } from '../utils/pointsCalc';
import { api } from '../utils/api';

export default function Leaderboard() {
  const { tournaments, activeTournament, selectTournament } = useTournament();
  const [selectedId, setSelectedId] = useState(activeTournament?._id || '');
  const [standings, setStandings] = useState([]);
  const [winner, setWinner] = useState(null);
  const [theme, setTheme] = useState('classic');
  const [showWatermark, setShowWatermark] = useState(true);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const boardRef = useRef(null);

  useEffect(() => {
    if (activeTournament?._id) setSelectedId(activeTournament._id);
  }, [activeTournament?._id]);

  useEffect(() => {
    if (!selectedId) return;
    selectTournament(selectedId);
    setLoading(true);
    api.getLeaderboard(selectedId)
      .then((data) => {
        setStandings(data.standings || []);
        setWinner(data.winner);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedId, selectTournament]);

  const themeConfig = LEADERBOARD_THEMES[theme];

  const exportPNG = async () => {
    if (!boardRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(boardRef.current, {
        backgroundColor: themeConfig.bg,
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement('a');
      link.download = `leaderboard-${activeTournament?.name || 'export'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white md:text-3xl">Live Leaderboard</h1>
          <p className="mt-1 text-sm text-slate-400">Klasemen real-time dengan theme switcher</p>
        </div>
        <Button variant="gold" onClick={exportPNG} loading={exporting}>
          <Download size={18} /> Export PNG
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="mb-2 block text-sm font-medium text-slate-300">Turnamen</label>
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
          <label className="mb-2 flex items-center gap-1 text-sm font-medium text-slate-300">
            <Palette size={14} /> Theme
          </label>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-800/50 px-4 py-3 text-white focus:outline-none"
          >
            {Object.entries(LEADERBOARD_THEMES).map(([key, t]) => (
              <option key={key} value={key}>{t.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={() => setShowWatermark((v) => !v)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-800/50 px-4 py-3 text-sm text-slate-300 hover:bg-slate-700/50"
          >
            {showWatermark ? <Eye size={16} /> : <EyeSlash size={16} />}
            Watermark {showWatermark ? 'On' : 'Off'}
          </button>
        </div>
      </div>

      {winner && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl border border-gold/30 bg-gold/10 p-4 glow-gold"
        >
          <p className="text-center text-sm font-bold text-gold">
            CHAMPIONS RUSH WINNER: {winner.teamName} ({winner.totalPoints} pts)
          </p>
        </motion.div>
      )}

      <div ref={boardRef} className="relative overflow-hidden rounded-2xl" style={{ background: themeConfig.bg }}>
        {showWatermark && (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.04]"
            style={{ transform: 'rotate(-25deg)' }}
          >
            <span className="text-6xl font-black" style={{ color: themeConfig.text }}>
              GRIDPLAY FF
            </span>
          </div>
        )}

        <div className="relative p-6">
          <div className="mb-6 text-center">
            <h2 className="text-xl font-bold" style={{ color: themeConfig.header }}>
              {activeTournament?.name || 'Leaderboard'}
            </h2>
            <p className="mt-1 text-xs opacity-60" style={{ color: themeConfig.text }}>
              GridPlay FF Edition | {LEADERBOARD_THEMES[theme].name} Theme
            </p>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg opacity-20" style={{ background: themeConfig.row }} />
              ))}
            </div>
          ) : standings.length === 0 ? (
            <p className="py-12 text-center text-sm opacity-50" style={{ color: themeConfig.text }}>
              Belum ada data klasemen. Input match terlebih dahulu.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ color: themeConfig.header }}>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">#</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Team</th>
                    {theme !== 'minimal' && (
                      <>
                        <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">Booyah</th>
                        <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">Kills</th>
                        <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">Match</th>
                      </>
                    )}
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s, i) => (
                    <motion.tr
                      key={s.teamId || s.teamName}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="border-t border-white/5"
                      style={{ background: i % 2 === 0 ? themeConfig.row : 'transparent' }}
                    >
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg font-mono text-sm font-bold"
                          style={{
                            background: s.rank <= 3 ? themeConfig.accent + '33' : 'transparent',
                            color: s.rank <= 3 ? themeConfig.accent : themeConfig.text,
                          }}
                        >
                          {s.rank}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold" style={{ color: themeConfig.text }}>
                        {s.teamName}
                      </td>
                      {theme !== 'minimal' && (
                        <>
                          <td className="px-4 py-3 text-center font-mono" style={{ color: themeConfig.text }}>
                            {s.booyahCount}
                          </td>
                          <td className="px-4 py-3 text-center font-mono" style={{ color: themeConfig.text }}>
                            {s.totalKills}
                          </td>
                          <td className="px-4 py-3 text-center font-mono" style={{ color: themeConfig.text }}>
                            {s.matchesPlayed}
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3 text-right font-mono text-lg font-bold" style={{ color: themeConfig.accent }}>
                        {s.totalPoints}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
