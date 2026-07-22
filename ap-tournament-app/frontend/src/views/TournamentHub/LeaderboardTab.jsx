import { useEffect, useState, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Download } from '@phosphor-icons/react';
import Button from '../../components/Button';
import OfficialLeaderboard from '../../components/OfficialLeaderboard';
import { exportElementAsPNG } from '../../utils/exportUtils';
import { api } from '../../utils/api';

export default function LeaderboardTab() {
  const { tournament } = useOutletContext();
  const [standings, setStandings] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const boardRef = useRef(null);

  useEffect(() => {
    Promise.all([
      api.getLeaderboard(tournament._id),
      api.getTournament(tournament._id),
    ]).then(([lb, t]) => {
      setStandings(lb.standings || []);
      setMatches(t.matches || []);
    }).finally(() => setLoading(false));
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

  if (loading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-slate-800" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-white">Live Leaderboard</h2>
          <p className="text-xs text-slate-500">Format 9:16 — siap untuk Instagram Story / WhatsApp Status</p>
        </div>
        <Button variant="gold" onClick={handleExport} loading={exporting}>
          <Download size={16} /> Download Leaderboard PNG
        </Button>
      </div>

      <OfficialLeaderboard
        boardRef={boardRef}
        tournament={tournament}
        standings={standings}
        matches={matches}
      />
    </div>
  );
}
