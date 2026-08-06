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
  onLog?.(`Merge: ${merged.length} placements, ${nicknames.length} nicknames`);
  onProgress?.(100);
  return { success: true, entries: merged, nicknames, errors };
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
    merged.push({
      placement: p, rank: p, teamName: bestName, nickname: bestName, kills: bestKills, votes: group.length,
    });
  }
  return merged;
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

export function matchTeamsToRoster(ocrResults, registeredTeams) {
  return ocrResults.map((ocr) => {
    const normalized = (ocr.teamName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    let bestMatch = null;
    let bestScore = 0;

    registeredTeams.forEach((team) => {
      const teamNorm = team.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      let score = 0;
      if (teamNorm === normalized) score = 100;
      else if (teamNorm.includes(normalized) || normalized.includes(teamNorm)) score = 75;
      else {
        team.name.toLowerCase().split(/\s+/).forEach((w) => {
          if (w.length > 2 && normalized.includes(w.replace(/[^a-z0-9]/g, ''))) score += 25;
        });
      }
      if (score > bestScore) { bestScore = score; bestMatch = team; }
    });

    return {
      ...ocr,
      teamId: bestMatch?._id || null,
      matchedTeamName: bestMatch?.name || ocr.teamName,
      matchConfidence: bestScore,
    };
  });
}
