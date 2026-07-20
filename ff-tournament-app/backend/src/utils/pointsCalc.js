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
    const kills = Math.max(0, r.kills || 0);
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

  matches
    .filter((m) => m.status === 'completed' || m.status === 'verified')
    .forEach((match) => {
      match.results.forEach((r) => {
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
  const winner = standings.find((s) => s.totalPoints >= targetPoints && s.booyahCount > 0);
  return winner || null;
}

export function parseRosterInput(text) {
  const lines = text.split('\n').filter((l) => l.trim());
  const teams = [];

  lines.forEach((line) => {
    const parts = line.split('|').map((p) => p.trim());
    if (parts.length < 1) return;

    const teamName = parts[0];
    const playerPart = parts[1] || '';
    const players = playerPart
      .split('//')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((nickname) => ({ nickname }));

    teams.push({ name: teamName, players });
  });

  return teams;
}
