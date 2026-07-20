import { useEffect, useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Download } from '@phosphor-icons/react';
import Button from '../../components/Button';
import { exportElementAsPNG } from '../../utils/exportUtils';
import { LEADERBOARD_THEMES } from '../../utils/pointsCalc';
import { api } from '../../utils/api';

export default function LeaderboardTab() {
  const { tournament } = useOutletContext();
  const [standings, setStandings] = useState([]);
  const [theme, setTheme] = useState('classic');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const boardRef = useRef(null);

  useEffect(() => {
    api.getLeaderboard(tournament._id)
      .then((d) => setStandings(d.standings || []))
      .finally(() => setLoading(false));
  }, [tournament._id]);

  const tc = LEADERBOARD_THEMES[theme];

  const handleExport = async () => {
    if (!boardRef.current) return;
    setExporting(true);
    try {
      await exportElementAsPNG(boardRef.current, `leaderboard-${tournament.name}.png`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-bold text-white">Live Leaderboard</h2>
        <div className="flex gap-2">
          <select value={theme} onChange={(e) => setTheme(e.target.value)}
            className="rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white">
            {Object.entries(LEADERBOARD_THEMES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
          </select>
          <Button variant="gold" onClick={handleExport} loading={exporting}>
            <Download size={16} /> Download Leaderboard PNG
          </Button>
        </div>
      </div>

      <div ref={boardRef} className="overflow-hidden rounded-2xl p-6" style={{ background: tc.bg }}>
        <h3 className="mb-4 text-center text-lg font-bold" style={{ color: tc.header }}>{tournament.name}</h3>
        {loading ? (
          <div className="h-40 animate-pulse rounded bg-white/5" />
        ) : standings.length === 0 ? (
          <p className="py-8 text-center text-sm opacity-50" style={{ color: tc.text }}>No standings yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: tc.header }}>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Team</th>
                <th className="px-3 py-2 text-center">Booyah</th>
                <th className="px-3 py-2 text-center">Kills</th>
                <th className="px-3 py-2 text-right">Total Score</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <tr key={s.teamId || s.teamName} style={{ background: i % 2 ? 'transparent' : tc.row }}>
                  <td className="px-3 py-2 font-mono font-bold" style={{ color: s.rank <= 3 ? tc.accent : tc.text }}>{s.rank}</td>
                  <td className="px-3 py-2 font-semibold" style={{ color: tc.text }}>{s.teamName}</td>
                  <td className="px-3 py-2 text-center font-mono" style={{ color: tc.text }}>{s.booyahCount}</td>
                  <td className="px-3 py-2 text-center font-mono" style={{ color: tc.text }}>{s.totalKills}</td>
                  <td className="px-3 py-2 text-right font-mono text-lg font-bold" style={{ color: tc.accent }}>{s.totalPoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-4 text-center text-[10px] opacity-40" style={{ color: tc.text }}>AP (Arthur Points)</p>
      </div>
    </div>
  );
}
