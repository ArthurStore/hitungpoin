import { api } from './api.js';

const SERVER_OCR_TIMEOUT_MS = 90000;

async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

/** Primary OCR: Gemini Vision via backend */
export async function scanWithLogs(dataUrl, onLog, onProgress) {
  onLog?.('Sending screenshot to Gemini Vision (gemini-flash-latest)...', 5);
  onProgress?.(10);

  try {
    const blob = await dataUrlToBlob(dataUrl);
    onProgress?.(25);
    const result = await api.scanOcr(blob, SERVER_OCR_TIMEOUT_MS);

    if (result.success && (result.results?.length || result.text?.trim())) {
      onLog?.(`Gemini OK${result.latencyMs ? ` (${result.latencyMs}ms)` : ''} — ${result.results?.length || 0} rows`, 100);
      onProgress?.(100);
      return result;
    }

    onLog?.(`Gemini failed: ${result.error || 'empty result'}`, 0);
    return { success: false, error: result.error || 'Gemini OCR failed', text: '', results: [] };
  } catch (err) {
    onLog?.(`OCR error: ${err.message}`, 0);
    return { success: false, error: err.message, text: '', results: [] };
  }
}

export async function terminateWorker() {
  // no client WASM worker anymore
}

export function parseGeminiResults(results) {
  return (results || []).map((r) => {
    const players = Array.isArray(r.players)
      ? r.players.map((p) => ({
        nickname: p.nickname || p.name || '',
        kills: parseInt(p.kills, 10) || 0,
      })).filter((p) => p.nickname).slice(0, 4)
      : [];
    const nick = r.nickname || r.teamName || r.team_name || players[0]?.nickname || '';
    return {
      placement: r.placement || r.rank,
      rank: r.rank || r.placement,
      teamName: r.teamName || r.team_name || nick || '',
      nickname: nick,
      kills: parseInt(r.kills, 10) || 0,
      totalScore: parseInt(r.kills, 10) || 0,
      players: players.length ? players : (nick ? [{ nickname: nick, kills: parseInt(r.kills, 10) || 0 }] : []),
    };
  });
}

/** Legacy text parsers kept as secondary fallback if Gemini returns only text */
export function parseCrBiasa(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const results = [];
  const seen = new Set();

  lines.forEach((line) => {
    const killLine = line.match(
      /^(?:#?\s*)?(\d{1,2})[.)\s:-]+([A-Za-z0-9_\-!?.][A-Za-z0-9_\-!?.\s]{1,28}?)\s+(\d{1,3})\s*[Kk]ills?/i
    );
    if (killLine) {
      const placement = parseInt(killLine[1], 10);
      if (placement >= 1 && placement <= 12 && !seen.has(placement)) {
        seen.add(placement);
        results.push({
          placement,
          rank: placement,
          teamName: killLine[2].trim(),
          nickname: killLine[2].trim(),
          kills: parseInt(killLine[3], 10),
        });
      }
    }
  });
  return results.sort((a, b) => a.placement - b.placement);
}

export function parseCrLeague(text) {
  return parseCrBiasa(text);
}

export function parseByMode(text, mode) {
  return mode === 'cr_league' ? parseCrLeague(text) : parseCrBiasa(text);
}

export async function scanMultiPass(dataUrls, mode, onLog, onProgress) {
  const allParsed = [];
  const errors = [];
  const total = dataUrls.length || 1;

  for (let i = 0; i < dataUrls.length; i += 1) {
    onLog?.(`--- Pass ${i + 1}/${dataUrls.length}: Gemini Vision ---`);
    const base = (i / total) * 100;
    const result = await scanWithLogs(dataUrls[i], onLog, (pct) => {
      onProgress?.(Math.round(base + pct / total));
    });

    if (!result.success) {
      errors.push(result.error || `Pass ${i + 1} failed`);
      continue;
    }

    let parsed = [];
    if (result.results?.length) {
      parsed = parseGeminiResults(result.results);
    } else if (result.text) {
      parsed = parseByMode(result.text, mode);
    }

    onLog?.(`Pass ${i + 1}: ${parsed.length} entries`);
    parsed.forEach((p) => allParsed.push({ ...p, pass: i + 1 }));
  }

  if (allParsed.length === 0) {
    return {
      success: false,
      error: errors[0] || 'Gemini tidak menemukan data — gunakan Manual Input',
      entries: [],
      nicknames: [],
    };
  }

  const merged = mergeMultiPassResults(allParsed);
  const nicknames = extractNicknameList(allParsed);
  const teamGroups = extractTeamGroups(merged);
  onLog?.(`Merge: ${merged.length} tim/placement, ${teamGroups.reduce((s, g) => s + g.nicknames.length, 0)} nicknames`);
  onProgress?.(100);
  return { success: true, entries: merged, nicknames, teamGroups, errors };
}

export function mergeMultiPassResults(allParsed) {
  const byPlacement = new Map();
  allParsed.forEach((r) => {
    const place = r.placement || r.rank;
    if (!place || place < 1 || place > 12) return;
    if (!byPlacement.has(place)) byPlacement.set(place, []);
    byPlacement.get(place).push(r);
  });

  const merged = [];
  for (let p = 1; p <= 12; p += 1) {
    const group = byPlacement.get(p);
    if (!group?.length) continue;
    const nameVotes = {};
    const killVotes = {};
    group.forEach((g) => {
      const n = (g.teamName || g.nickname || '').trim();
      if (n) nameVotes[n] = (nameVotes[n] || 0) + 1;
      const k = parseInt(g.kills ?? 0, 10) || 0;
      killVotes[k] = (killVotes[k] || 0) + 1;
    });
    const bestName = Object.entries(nameVotes).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    const bestKills = parseInt(Object.entries(killVotes).sort((a, b) => b[1] - a[1])[0]?.[0] || '0', 10);
    const players = mergePlayersFromGroup(group);
    merged.push({
      placement: p,
      rank: p,
      teamName: bestName,
      nickname: bestName,
      kills: bestKills,
      votes: group.length,
      players,
    });
  }
  return merged;
}

function mergePlayersFromGroup(group) {
  const byNick = new Map();
  group.forEach((g) => {
    const list = Array.isArray(g.players) && g.players.length
      ? g.players
      : [{ nickname: g.nickname || g.teamName || '', kills: g.kills || 0 }];
    list.forEach((p) => {
      const nick = String(p.nickname || p.name || p || '').trim();
      if (!nick || nick.length < 2) return;
      const key = nick.toLowerCase();
      const prev = byNick.get(key) || { nickname: nick, kills: 0 };
      prev.kills = Math.max(prev.kills, parseInt(p.kills, 10) || 0);
      byNick.set(key, prev);
    });
  });
  return Array.from(byNick.values()).slice(0, 4);
}

/** One entry per placement: up to 4 nicknames as a single team unit (OCR screen) */
export function extractTeamGroups(entries) {
  return (entries || [])
    .filter((r) => (r.placement || r.rank) >= 1)
    .map((r) => {
      const players = (r.players || [])
        .map((p) => (typeof p === 'string' ? { nickname: p } : p))
        .filter((p) => p.nickname)
        .slice(0, 4);
      const nicknames = players.length
        ? players.map((p) => p.nickname)
        : [r.nickname || r.teamName].filter(Boolean);
      return {
        placement: r.placement || r.rank,
        kills: r.kills ?? 0,
        teamName: r.teamName || '',
        nickname: r.nickname || nicknames[0] || '',
        nicknames,
        players: nicknames.map((n, i) => players[i] || { nickname: n, kills: 0 }),
      };
    })
    .sort((a, b) => a.placement - b.placement);
}

export function extractNicknameList(allParsed) {
  const map = new Map();
  allParsed.forEach((r) => {
    const candidates = [
      r.nickname || r.teamName,
      ...((r.players || []).map((p) => p.nickname || p)),
    ].filter(Boolean);

    candidates.forEach((nRaw) => {
      const n = String(nRaw).trim();
      if (!n || n.length < 2) return;
      const key = n.toLowerCase();
      const prev = map.get(key) || { nickname: n, kills: 0, hits: 0, placements: [] };
      prev.hits += 1;
      prev.kills = Math.max(prev.kills, parseInt(r.kills, 10) || 0);
      if (r.placement) prev.placements.push(r.placement);
      map.set(key, prev);
    });
  });
  return Array.from(map.values()).sort((a, b) => b.hits - a.hits);
}

function normNick(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function uniqueNorms(list) {
  const seen = new Set();
  const out = [];
  list.forEach((n) => {
    if (!n || seen.has(n)) return;
    seen.add(n);
    out.push(n);
  });
  return out;
}

/**
 * Auto-match OCR placement → registered team.
 * Requires ≥2 roster nick hits (incl. substitutes 5–6) OR strong team-name match.
 */
export function matchTeamsToRoster(ocrResults, registeredTeams) {
  return ocrResults.map((ocr) => {
    const ocrNicks = uniqueNorms([
      ...(ocr.players || []).map((p) => normNick(p.nickname || p)),
      normNick(ocr.nickname),
      normNick(ocr.teamName),
    ]);

    let bestMatch = null;
    let bestScore = 0;

    (registeredTeams || []).forEach((team) => {
      const teamNorm = normNick(team.name);
      const rosterNicks = uniqueNorms(
        (team.players || []).map((p) => normNick(p.nickname || p.name || p))
      );

      let score = 0;
      // Strong name match
      if (teamNorm && ocrNicks.some((n) => n === teamNorm)) score = 100;
      else if (teamNorm && teamNorm.length >= 3 && ocrNicks.some((n) => n.includes(teamNorm) || teamNorm.includes(n))) {
        score = 80;
      }

      // Roster memory: need ≥2 overlapping nicks for auto-select (incl. cadangan)
      const rosterHits = ocrNicks.filter((n) =>
        rosterNicks.some((r) =>
          r === n || (r.length > 2 && n.length > 2 && (r.includes(n) || n.includes(r)))
        )
      ).length;

      if (rosterHits >= 2) {
        score = Math.max(score, 90 + Math.min(rosterHits, 4) * 2);
      } else if (rosterHits === 1 && score < 80) {
        score = Math.max(score, 45); // weak — not enough alone for confident auto-select
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = team;
      }
    });

    // Only auto-bind when confidence is solid (≥70)
    const confident = bestScore >= 70;
    return {
      ...ocr,
      teamId: confident ? (bestMatch?._id || null) : null,
      matchedTeamName: confident ? (bestMatch?.name || ocr.teamName) : ocr.teamName,
      matchConfidence: bestScore,
    };
  });
}

