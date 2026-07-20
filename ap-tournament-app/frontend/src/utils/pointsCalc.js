export const MAPS = [
  'Bermuda', 'Kalahari', 'Purgatory', 'Nexterra', 'Alpine',
  'Bermuda Remastered', 'Solara',
];

export const FORMATS = [
  { id: 'One Day', label: 'One Day', matches: 6 },
  { id: 'Fast Tour', label: 'Fast Tour', matches: 4 },
  { id: 'Champions Rush', label: 'Champions Rush', matches: 8 },
  { id: 'CR League', label: 'CR League', matches: 6 },
];

export const LEADERBOARD_THEMES = {
  classic: { name: 'Classic', bg: '#1e293b', header: '#ef4444', row: '#334155', text: '#f1f5f9', accent: '#ef4444' },
  neon: { name: 'Neon', bg: '#0f0f23', header: '#ff006e', row: '#1a1a2e', text: '#00f5d4', accent: '#ff006e' },
  minimal: { name: 'Minimal', bg: '#ffffff', header: '#0f172a', row: '#f8fafc', text: '#0f172a', accent: '#0f172a' },
  darkPro: { name: 'Dark Pro', bg: '#111827', header: '#f59e0b', row: '#1f2937', text: '#f9fafb', accent: '#f59e0b' },
};

export function calcMatchPoints(results, mode = 'cr_biasa') {
  const placementPts = { 1: 12, 2: 9, 3: 8, 4: 7, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1, 11: 0, 12: 0 };
  return results.map((r) => {
    if (mode === 'cr_league') {
      const placement = r.placement || r.rank;
      const totalScore = parseInt(r.totalScore ?? r.score ?? 0, 10);
      return { ...r, placement, totalPoints: totalScore, totalScore, isBooyah: placement === 1, mode: 'cr_league' };
    }
    const placement = Math.min(12, Math.max(1, r.placement || 12));
    const kills = parseInt(r.kills, 10) || 0;
    const pp = placementPts[placement] ?? 0;
    const bonus = placement === 1 ? 5 : 0;
    return { ...r, placement, kills, placementPoints: pp, killPoints: kills, totalPoints: pp + kills + bonus, isBooyah: placement === 1, mode: 'cr_biasa' };
  });
}
