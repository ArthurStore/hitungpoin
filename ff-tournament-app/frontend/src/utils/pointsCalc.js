const DEFAULT_PLACEMENT = {
  1: 12, 2: 9, 3: 8, 4: 7, 5: 6, 6: 5,
  7: 4, 8: 3, 9: 2, 10: 1, 11: 0, 12: 0,
};

export function calcMatchPoints(results, rules = {}) {
  const placementPts = rules.placementPoints || DEFAULT_PLACEMENT;
  const killPt = rules.killPoint ?? 1;
  const booyahBonus = rules.booyahBonus ?? 5;

  return results.map((r) => {
    const placement = Math.min(12, Math.max(1, r.placement || 12));
    const kills = Math.max(0, parseInt(r.kills, 10) || 0);
    const isBooyah = placement === 1;
    const pp = placementPts[placement] ?? 0;
    const kp = kills * killPt;
    const bonus = isBooyah ? booyahBonus : 0;

    return {
      ...r,
      placement,
      kills,
      isBooyah,
      placementPoints: pp,
      killPoints: kp,
      totalPoints: pp + kp + bonus,
    };
  });
}

export function aggregateStandings(matches, teams) {
  const standings = {};

  teams.forEach((team) => {
    standings[team._id] = {
      teamId: team._id,
      teamName: team.name,
      tag: team.tag,
      totalPoints: 0,
      totalKills: 0,
      booyahCount: 0,
      matchesPlayed: 0,
      placements: [],
    };
  });

  (matches || [])
    .filter((m) => m.status === 'completed' || m.status === 'verified')
    .forEach((match) => {
      (match.results || []).forEach((r) => {
        const key = r.teamId || r.teamName;
        if (!standings[key]) {
          standings[key] = {
            teamId: r.teamId,
            teamName: r.teamName,
            totalPoints: 0,
            totalKills: 0,
            booyahCount: 0,
            matchesPlayed: 0,
            placements: [],
          };
        }
        const s = standings[key];
        s.totalPoints += r.totalPoints || 0;
        s.totalKills += r.kills || 0;
        s.booyahCount += r.isBooyah ? 1 : 0;
        s.matchesPlayed += 1;
        s.placements.push(r.placement);
      });
    });

  return Object.values(standings)
    .sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.booyahCount !== a.booyahCount) return b.booyahCount - a.booyahCount;
      return b.totalKills - a.totalKills;
    })
    .map((s, i) => ({ ...s, rank: i + 1 }));
}

export function checkChampionsRushWinner(standings, targetPoints) {
  return standings.find((s) => s.totalPoints >= targetPoints && s.booyahCount > 0) || null;
}

export const MAPS = ['Bermuda', 'Purgatory', 'Kalahari', 'Nexterra', 'Alpine', 'Solara'];

export const FORMATS = [
  { id: 'Fast Tour', label: 'Fast Tour', matches: 4, desc: 'Format cepat 4 match' },
  { id: 'One Day', label: 'One Day', matches: 6, desc: 'Turnamen satu hari, 6 match' },
  { id: 'Champions Rush', label: 'Champions Rush', matches: 8, desc: 'Target poin + Booyah untuk menang' },
];

export const LEADERBOARD_THEMES = {
  classic: {
    name: 'Classic',
    bg: '#1e293b',
    header: '#ef4444',
    row: '#334155',
    text: '#f1f5f9',
    accent: '#ef4444',
  },
  detail: {
    name: 'Detail',
    bg: '#0f172a',
    header: '#10b981',
    row: '#1e293b',
    text: '#e2e8f0',
    accent: '#10b981',
  },
  dark: {
    name: 'Dark',
    bg: '#0a0a0a',
    header: '#6366f1',
    row: '#171717',
    text: '#fafafa',
    accent: '#6366f1',
  },
  darkPro: {
    name: 'Dark Pro',
    bg: '#111827',
    header: '#f59e0b',
    row: '#1f2937',
    text: '#f9fafb',
    accent: '#f59e0b',
  },
  neon: {
    name: 'Neon',
    bg: '#0f0f23',
    header: '#ff006e',
    row: '#1a1a2e',
    text: '#00f5d4',
    accent: '#ff006e',
  },
  minimal: {
    name: 'Minimal',
    bg: '#ffffff',
    header: '#0f172a',
    row: '#f8fafc',
    text: '#0f172a',
    accent: '#0f172a',
  },
};
