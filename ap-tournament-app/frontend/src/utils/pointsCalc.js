export const DEFAULT_PLACEMENT_POINTS = {
  1: 12, 2: 9, 3: 8, 4: 7, 5: 6, 6: 5,
  7: 4, 8: 3, 9: 2, 10: 1, 11: 0, 12: 0,
};

export const DEFAULT_KILL_POINT = 1;
export const DEFAULT_BOOYAH_BONUS = 5;

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

export const MATCH_COUNT_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1);

export function getScoringRules(tournament) {
  const pp = tournament?.scoringRules?.placementPoints;
  return {
    placementPoints: pp ? { ...DEFAULT_PLACEMENT_POINTS, ...pp } : { ...DEFAULT_PLACEMENT_POINTS },
    killPoint: tournament?.scoringRules?.killPoint ?? DEFAULT_KILL_POINT,
    booyahBonus: tournament?.scoringRules?.booyahBonus ?? DEFAULT_BOOYAH_BONUS,
  };
}

export function buildDefaultScoringRules() {
  return {
    placementPoints: { ...DEFAULT_PLACEMENT_POINTS },
    killPoint: DEFAULT_KILL_POINT,
    booyahBonus: DEFAULT_BOOYAH_BONUS,
  };
}

export function calcMatchPoints(results, mode = 'cr_biasa', scoringRules = {}) {
  const placementPts = { ...DEFAULT_PLACEMENT_POINTS, ...scoringRules.placementPoints };
  const killPt = scoringRules.killPoint ?? DEFAULT_KILL_POINT;
  const booyahBonus = scoringRules.booyahBonus ?? DEFAULT_BOOYAH_BONUS;

  return results.map((r) => {
    if (mode === 'cr_league') {
      const placement = r.placement || r.rank;
      const totalScore = parseInt(r.totalScore ?? r.score ?? 0, 10);
      return {
        ...r,
        placement,
        totalPoints: totalScore,
        totalScore,
        isBooyah: placement === 1,
        mode: 'cr_league',
      };
    }

    const placement = Math.min(12, Math.max(1, r.placement || 12));
    const kills = parseInt(r.kills, 10) || 0;
    const pp = placementPts[placement] ?? 0;
    const kp = kills * killPt;
    const bonus = placement === 1 ? booyahBonus : 0;

    return {
      ...r,
      placement,
      kills,
      placementPoints: pp,
      killPoints: kp,
      totalPoints: pp + kp + bonus,
      isBooyah: placement === 1,
      mode: 'cr_biasa',
    };
  });
}

export function calcSingleRowPoints(placement, kills, mode, scoringRules) {
  const [row] = calcMatchPoints(
    [{ placement, kills, totalScore: kills }],
    mode,
    scoringRules
  );
  return row?.totalPoints ?? 0;
}

/** Default placement points for a rank (editable override lives in form rows). */
export function getDefaultPlacementPoints(placement, scoringRules = {}) {
  const map = { ...DEFAULT_PLACEMENT_POINTS, ...scoringRules.placementPoints };
  return map[placement] ?? 0;
}

/**
 * Live total: (kills * killPt) + placementPts
 * If placementPts omitted, uses scoring table + booyah bonus for #1.
 */
export function calcLiveTotal({ placement, kills, placementPoints, mode, scoringRules }) {
  if (mode === 'cr_league') {
    return parseInt(kills ?? placementPoints ?? 0, 10) || 0;
  }
  const killPt = scoringRules?.killPoint ?? DEFAULT_KILL_POINT;
  const k = parseInt(kills, 10) || 0;
  let pp = placementPoints;
  if (pp === '' || pp === null || pp === undefined) {
    pp = getDefaultPlacementPoints(placement, scoringRules);
    if (placement === 1) pp += scoringRules?.booyahBonus ?? DEFAULT_BOOYAH_BONUS;
  } else {
    pp = parseInt(pp, 10) || 0;
  }
  return k * killPt + pp;
}

export function buildMatchConfigs(totalMatches, existing = []) {
  return Array.from({ length: totalMatches }, (_, i) => ({
    matchNumber: i + 1,
    map: existing[i]?.map || MAPS[i % MAPS.length],
  }));
}

export function aggregateStandingsWithMatches(matches, teams) {
  const standings = {};

  teams.forEach((team) => {
    standings[team._id] = {
      teamId: team._id,
      teamName: team.name,
      totalPoints: 0,
      totalKills: 0,
      booyahCount: 0,
      matchScores: {},
    };
  });

  (matches || [])
    .filter((m) => m.status === 'verified' || m.status === 'completed')
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
            matchScores: {},
          };
        }
        const s = standings[key];
        const pts = r.totalPoints || 0;
        s.totalPoints += pts;
        s.totalKills += r.kills || 0;
        s.booyahCount += r.isBooyah ? 1 : 0;
        s.matchScores[match.matchNumber] = pts;
      });
    });

  return Object.values(standings)
    .sort((a, b) => b.totalPoints - a.totalPoints || b.booyahCount - a.booyahCount)
    .map((s, i) => ({ ...s, rank: i + 1 }));
}
