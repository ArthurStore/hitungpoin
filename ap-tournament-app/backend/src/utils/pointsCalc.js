const DEFAULT_PLACEMENT = {
  1: 12, 2: 9, 3: 8, 4: 7, 5: 6, 6: 5,
  7: 4, 8: 3, 9: 2, 10: 1, 11: 0, 12: 0,
};

export function calcMatchPoints(results, rules = {}, mode = 'cr_biasa') {
  const placementPts = rules.placementPoints || DEFAULT_PLACEMENT;
  const killPt = rules.killPoint ?? 1;
  const booyahBonus = rules.booyahBonus ?? 5;

  return results.map((r) => {
    if (mode === 'cr_league') {
      const placement = Math.min(12, Math.max(1, r.placement || r.rank || 12));
      const totalScore = parseInt(r.totalScore ?? r.score ?? 0, 10);
      return {
        ...r,
        placement,
        teamName: r.teamName,
        totalScore,
        kills: r.kills || 0,
        placementPoints: 0,
        killPoints: 0,
        totalPoints: totalScore,
        isBooyah: placement === 1,
        mode: 'cr_league',
      };
    }

    const placement = Math.min(12, Math.max(1, r.placement || 12));
    const kills = Math.max(0, parseInt(r.kills, 10) || 0);
    const isBooyah = placement === 1;
    const defaultPp = placementPts[placement] ?? 0;
    const bonus = isBooyah ? booyahBonus : 0;
    const pp = r.placementPoints != null && r.placementPoints !== ''
      ? parseInt(r.placementPoints, 10) || 0
      : defaultPp + bonus;
    const kp = kills * killPt;
    const total = r.totalPoints != null && !Number.isNaN(Number(r.totalPoints))
      ? Number(r.totalPoints)
      : (r.placementPoints != null && r.placementPoints !== '' ? pp + kp : defaultPp + kp + bonus);

    return {
      ...r,
      placement,
      kills,
      isBooyah,
      placementPoints: r.placementPoints != null && r.placementPoints !== '' ? pp : defaultPp,
      killPoints: kp,
      totalPoints: total,
      mode: 'cr_biasa',
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
      logo: team.logo || '',
      totalPoints: 0,
      totalKills: 0,
      booyahCount: 0,
      matchesPlayed: 0,
      placements: [],
      matchScores: {},
      matchBreakdown: {},
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
            logo: '',
            totalPoints: 0,
            totalKills: 0,
            booyahCount: 0,
            matchesPlayed: 0,
            placements: [],
            matchScores: {},
            matchBreakdown: {},
          };
        }
        const s = standings[key];
        s.totalPoints += r.totalPoints || 0;
        s.totalKills += r.kills || 0;
        s.booyahCount += r.isBooyah ? 1 : 0;
        s.matchesPlayed += 1;
        s.placements.push(r.placement);
        s.matchScores[match.matchNumber] = r.totalPoints || 0;
        s.matchBreakdown[match.matchNumber] = {
          totalPoints: r.totalPoints || 0,
          placementPoints: r.placementPoints || 0,
          killPoints: r.killPoints || 0,
          kills: r.kills || 0,
          mode: r.mode || match.inputMode || 'cr_biasa',
        };
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

export function parseRosterInput(text) {
  const lines = text.split('\n').filter((l) => l.trim());
  return lines.map((line) => {
    const parts = line.split('|').map((p) => p.trim());
    const teamName = parts[0];
    const playerPart = parts[1] || '';
    const players = playerPart
      .split('//')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((nickname) => ({ nickname }))
      .slice(0, 6);
    const representative = players[0]?.nickname || '';
    return { name: teamName, representative, players };
  });
}

export const MAPS = [
  'Bermuda', 'Kalahari', 'Purgatory', 'Nexterra', 'Alpine',
  'Bermuda Remastered', 'Solara',
];
