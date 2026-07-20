import Tesseract from 'tesseract.js';

const RECOGNIZE_TIMEOUT_MS = 25000;

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

  onLog?.('Initializing Tesseract worker...', 0);

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

  onLog?.('Tesseract engine ready.', 100);
  return workerInstance;
}

function withTimeout(promise, ms, onLog) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        onLog?.(`ERROR: Scan timed out after ${ms / 1000}s`, 0);
        reject(new Error(`OCR timeout: scan exceeded ${ms / 1000} seconds`));
      }, ms);
    }),
  ]);
}

export async function scanWithLogs(dataUrl, onLog, onProgress) {
  try {
    onLog?.('Starting OCR scan...', 0);
    const worker = await getWorker(onLog);

    const recognizePromise = worker.recognize(dataUrl, {}, (m) => {
      if (m.status === 'recognizing text') {
        const pct = Math.round((m.progress || 0) * 100);
        onProgress?.(pct);
        onLog?.(`Recognizing text... ${pct}%`, pct);
      }
    });

    const result = await withTimeout(recognizePromise, RECOGNIZE_TIMEOUT_MS, onLog);
    onLog?.('Completed!', 100);
    onProgress?.(100);
    return { success: true, text: result.data.text };
  } catch (err) {
    onLog?.(`ERROR: ${err.message}`, 0);
    return { success: false, error: err.message, text: '' };
  }
}

export async function scanMultipleWithLogs(dataUrls, onLog, onProgress) {
  const results = [];
  for (let i = 0; i < dataUrls.length; i++) {
    onLog?.(`--- Processing image ${i + 1}/${dataUrls.length} ---`, 0);
    const baseProgress = (i / dataUrls.length) * 100;
    const res = await scanWithLogs(dataUrls[i], onLog, (pct) => {
      onProgress?.(Math.round(baseProgress + (pct / dataUrls.length)));
    });
    results.push({ index: i, ...res });
    if (!res.success) break;
  }
  return results;
}

/** Mode 1: CR Biasa - parse kill counts per team from full scoreboard */
export function parseCrBiasa(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const teamKills = {};

  lines.forEach((line) => {
    const killMatch = line.match(/(\d+)\s*[Kk]ill/i);
    if (killMatch) {
      const kills = parseInt(killMatch[1], 10);
      const namePart = line.replace(/\d+\s*[Kk]ill.*/i, '').trim();
      const tag = namePart.split(/\s+/)[0];
      if (tag && tag.length > 2) {
        teamKills[tag] = (teamKills[tag] || 0) + kills;
      }
    }
  });

  const rankBlocks = text.match(/(?:^|\n)\s*(\d{1,2})\s+([A-Za-z0-9\s_.!-]{3,40})/gm) || [];
  const results = [];
  const seen = new Set();

  rankBlocks.forEach((block) => {
    const m = block.match(/(\d{1,2})\s+(.+)/);
    if (!m) return;
    const placement = parseInt(m[1], 10);
    if (placement > 12 || seen.has(placement)) return;
    seen.add(placement);

    let teamName = m[2].trim().split(/\s+\d/)[0].trim();
    const tagMatch = teamName.match(/^([A-Z]{2,5})/);
    const tag = tagMatch?.[1];
    const kills = tag ? (teamKills[tag] || 0) : 0;

    results.push({ placement, teamName, kills, rank: placement });
  });

  if (results.length === 0) {
    return parseGenericRankTeamScore(text);
  }
  return results.sort((a, b) => a.placement - b.placement);
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
