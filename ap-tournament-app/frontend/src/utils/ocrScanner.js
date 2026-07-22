import Tesseract from 'tesseract.js';
import { api } from './api.js';

const CLIENT_OCR_TIMEOUT_MS = 20000;
const SERVER_OCR_TIMEOUT_MS = 60000;

let workerInstance = null;

function formatStatus(status) {
  const map = {
    'loading tesseract core': 'Initializing Tesseract engine...',
    'initializing tesseract': 'Initializing Tesseract engine...',
    'loading language traineddata': 'Loading language data...',
    'initializing api': 'Initializing OCR API...',
    'recognizing text': 'Recognizing text...',
  };
  return map[status] || status;
}

export async function terminateWorker() {
  if (workerInstance) {
    await workerInstance.terminate();
    workerInstance = null;
  }
}

async function getWorker(onLog) {
  if (workerInstance) return workerInstance;

  onLog?.('Initializing client Tesseract worker (fallback)...', 0);

  workerInstance = await Tesseract.createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        const pct = Math.round((m.progress || 0) * 100);
        onLog?.(`${formatStatus(m.status)} ${pct}%`, pct);
      } else if (m.status) {
        onLog?.(formatStatus(m.status), Math.round((m.progress || 0) * 100));
      }
    },
  });

  await workerInstance.setParameters({
    tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
  });

  onLog?.('Client OCR engine ready.', 100);
  return workerInstance;
}

function withTimeout(promise, ms, onLog, label = 'Scan') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        onLog?.(`ERROR: ${label} timed out after ${ms / 1000}s`, 0);
        reject(new Error(`${label} timeout: exceeded ${ms / 1000} seconds`));
      }, ms);
    }),
  ]);
}

async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

export async function scanServerOcr(dataUrl, onLog, onProgress) {
  onLog?.('Sending image to server OCR (Sharp + Tesseract)...', 5);
  onProgress?.(5);
  try {
    const blob = await dataUrlToBlob(dataUrl);
    const result = await api.scanOcr(blob, SERVER_OCR_TIMEOUT_MS);
    if (result.success) {
      onLog?.('Server OCR completed!', 100);
      onProgress?.(100);
    } else {
      onLog?.(`Server OCR failed: ${result.error}`, 0);
    }
    return result;
  } catch (err) {
    onLog?.(`Server OCR error: ${err.message}`, 0);
    return { success: false, error: err.message, text: '' };
  }
}

export async function scanClientOcr(dataUrl, onLog, onProgress) {
  try {
    onLog?.('Fallback: client-side OCR scan...', 0);
    const worker = await getWorker(onLog);

    const recognizePromise = worker.recognize(dataUrl, {}, (m) => {
      if (m.status === 'recognizing text') {
        const pct = Math.round((m.progress || 0) * 100);
        onProgress?.(pct);
        onLog?.(`Recognizing text... ${pct}%`, pct);
      }
    });

    const result = await withTimeout(recognizePromise, CLIENT_OCR_TIMEOUT_MS, onLog, 'Client OCR');
    onLog?.('Client OCR completed!', 100);
    onProgress?.(100);
    return { success: true, text: result.data.text, engine: 'client-tesseract' };
  } catch (err) {
    onLog?.(`Client OCR error: ${err.message}`, 0);
    return { success: false, error: err.message, text: '' };
  }
}

/** Hybrid pipeline: server first, client fallback */
export async function scanWithLogs(dataUrl, onLog, onProgress) {
  onLog?.('Starting hybrid OCR pipeline...', 0);

  const serverResult = await scanServerOcr(dataUrl, onLog, onProgress);
  if (serverResult.success && serverResult.text?.trim()) {
    return serverResult;
  }

  onLog?.('Server OCR unavailable, trying client fallback...', 10);
  const clientResult = await scanClientOcr(dataUrl, onLog, onProgress);
  if (clientResult.success) return clientResult;

  return {
    success: false,
    error: serverResult.error || clientResult.error || 'OCR failed',
    text: '',
  };
}

/** Mode 1: CR Biasa — scoreboard + match-history nickname/kill lines */
export function parseCrBiasa(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const results = [];
  const seen = new Set();

  // Pattern: "#1 Nickname 8 Kill" or "1. Nickname  8Kill"
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
      return;
    }

    // Nickname … N Kill (no explicit rank) — collect as nickname hits
    const nickKill = line.match(
      /^([A-Za-z0-9_\-!?.][A-Za-z0-9_\-!?.\s]{1,28}?)\s+(\d{1,3})\s*[Kk]ills?/i
    );
    if (nickKill && !/^\d+$/.test(nickKill[1])) {
      results.push({
        placement: null,
        rank: null,
        teamName: nickKill[1].trim(),
        nickname: nickKill[1].trim(),
        kills: parseInt(nickKill[2], 10),
        unranked: true,
      });
    }
  });

  // Rank + name blocks without kill suffix
  const rankBlocks = text.match(/(?:^|\n)\s*#?\s*(\d{1,2})[.)\s:-]+([A-Za-z0-9\s_.!-]{2,40})/gm) || [];
  rankBlocks.forEach((block) => {
    const m = block.match(/(\d{1,2})\D+(.+)/);
    if (!m) return;
    const placement = parseInt(m[1], 10);
    if (placement > 12 || seen.has(placement)) return;
    seen.add(placement);
    const teamName = m[2].replace(/\d+\s*[Kk]ill.*/i, '').trim().split(/\s{2,}/)[0].trim();
    if (!teamName || teamName.length < 2) return;
    const killMatch = block.match(/(\d+)\s*[Kk]ill/i);
    results.push({
      placement,
      rank: placement,
      teamName,
      nickname: teamName,
      kills: killMatch ? parseInt(killMatch[1], 10) : 0,
    });
  });

  const ranked = results.filter((r) => r.placement != null).sort((a, b) => a.placement - b.placement);
  if (ranked.length === 0) {
    const generic = parseGenericRankTeamScore(text);
    if (generic.length) return generic;
    // promote unranked nicknames into sequential slots
    return results
      .filter((r) => r.unranked)
      .slice(0, 12)
      .map((r, i) => ({ ...r, placement: i + 1, rank: i + 1, unranked: false }));
  }
  return ranked;
}

/**
 * Scan up to 3 screenshots and merge detections (multi-pass).
 * Returns { success, entries, nicknames, texts, errors }
 */
export async function scanMultiPass(dataUrls, mode, onLog, onProgress) {
  const allParsed = [];
  const texts = [];
  const errors = [];
  const total = dataUrls.length || 1;

  for (let i = 0; i < dataUrls.length; i += 1) {
    onLog?.(`--- Pass ${i + 1}/${dataUrls.length}: scanning screenshot ---`);
    const base = (i / total) * 100;
    const result = await scanWithLogs(dataUrls[i], onLog, (pct) => {
      onProgress?.(Math.round(base + pct / total));
    });

    if (!result.success || !result.text?.trim()) {
      errors.push(result.error || `Pass ${i + 1} failed`);
      onLog?.(`Pass ${i + 1} failed: ${result.error || 'empty'}`);
      continue;
    }

    texts.push(result.text);
    const parsed = parseByMode(result.text, mode);
    onLog?.(`Pass ${i + 1}: extracted ${parsed.length} entries`);
    parsed.forEach((p) => allParsed.push({ ...p, pass: i + 1 }));
  }

  if (allParsed.length === 0) {
    return {
      success: false,
      error: errors[0] || 'No data from any screenshot',
      entries: [],
      nicknames: [],
      texts,
    };
  }

  const merged = mergeMultiPassResults(allParsed);
  const nicknames = extractNicknameList(allParsed);

  onLog?.(`Multi-pass merge: ${merged.length} placements, ${nicknames.length} nicknames`);
  onProgress?.(100);

  return { success: true, entries: merged, nicknames, texts, errors };
}

/** Vote/merge by placement across passes */
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
      const k = parseInt(g.kills ?? g.totalScore ?? 0, 10) || 0;
      killVotes[k] = (killVotes[k] || 0) + 1;
    });

    const bestName = Object.entries(nameVotes).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    const bestKills = parseInt(Object.entries(killVotes).sort((a, b) => b[1] - a[1])[0]?.[0] || '0', 10);

    merged.push({
      placement: p,
      rank: p,
      teamName: bestName,
      nickname: bestName,
      kills: bestKills,
      totalScore: bestKills,
      votes: group.length,
    });
  }

  return merged;
}

export function extractNicknameList(allParsed) {
  const map = new Map();
  allParsed.forEach((r) => {
    const n = (r.nickname || r.teamName || '').trim();
    if (!n || n.length < 2) return;
    const key = n.toLowerCase();
    const prev = map.get(key) || { nickname: n, kills: 0, hits: 0, placements: [] };
    prev.hits += 1;
    prev.kills = Math.max(prev.kills, parseInt(r.kills, 10) || 0);
    if (r.placement) prev.placements.push(r.placement);
    map.set(key, prev);
  });
  return Array.from(map.values()).sort((a, b) => b.hits - a.hits || a.nickname.localeCompare(b.nickname));
}

/** Mode 2: CR League / RANKLIST - Rank | Team Name | Score */
export function parseCrLeague(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const results = [];

  lines.forEach((line) => {
    const ranklistMatch = line.match(/^(\d{1,2})\s+([A-Za-z0-9\s_.-]{2,30}?)\s+(\d{1,3})$/);
    if (ranklistMatch) {
      results.push({
        rank: parseInt(ranklistMatch[1], 10),
        placement: parseInt(ranklistMatch[1], 10),
        teamName: ranklistMatch[2].trim(),
        totalScore: parseInt(ranklistMatch[3], 10),
        score: parseInt(ranklistMatch[3], 10),
      });
      return;
    }

    const loose = line.match(/(\d{1,2})\D+([A-Za-z][A-Za-z0-9\s_.-]{2,25})\D+(\d{1,3})/);
    if (loose) {
      results.push({
        rank: parseInt(loose[1], 10),
        placement: parseInt(loose[1], 10),
        teamName: loose[2].trim(),
        totalScore: parseInt(loose[3], 10),
        score: parseInt(loose[3], 10),
      });
    }
  });

  const unique = [];
  const seen = new Set();
  results.sort((a, b) => a.rank - b.rank).forEach((r) => {
    if (!seen.has(r.rank)) { seen.add(r.rank); unique.push(r); }
  });
  return unique;
}

function parseGenericRankTeamScore(text) {
  const results = [];
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  lines.forEach((line) => {
    const m = line.match(/^(\d{1,2})\s+(.+?)\s+(\d{1,3})$/);
    if (m) {
      results.push({
        placement: parseInt(m[1], 10),
        rank: parseInt(m[1], 10),
        teamName: m[2].trim(),
        kills: parseInt(m[3], 10),
        totalScore: parseInt(m[3], 10),
      });
    }
  });
  return results;
}

export function parseByMode(text, mode) {
  return mode === 'cr_league' ? parseCrLeague(text) : parseCrBiasa(text);
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
