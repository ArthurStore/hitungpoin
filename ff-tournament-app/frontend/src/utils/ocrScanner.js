import Tesseract from 'tesseract.js';

let workerInstance = null;
let workerLang = null;

async function getWorker(lang = 'eng') {
  if (workerInstance && workerLang === lang) {
    return workerInstance;
  }

  if (workerInstance) {
    await workerInstance.terminate();
    workerInstance = null;
  }

  workerInstance = await Tesseract.createWorker(lang, 1, {
    logger: () => {},
  });

  await workerInstance.setParameters({
    tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
    tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .-_',
  });

  workerLang = lang;
  return workerInstance;
}

export async function terminateWorker() {
  if (workerInstance) {
    await workerInstance.terminate();
    workerInstance = null;
    workerLang = null;
  }
}

export async function scanImage(dataUrl, onProgress) {
  const worker = await getWorker('eng');

  const result = await worker.recognize(dataUrl, {}, (m) => {
    if (onProgress && m.status === 'recognizing text') {
      onProgress(Math.round(m.progress * 100));
    }
  });

  return result.data.text;
}

export async function scanMultipleImages(dataUrls, onStatus) {
  const allResults = [];

  for (let i = 0; i < dataUrls.length; i++) {
    if (onStatus) onStatus({ current: i + 1, total: dataUrls.length, phase: 'scanning' });

    const text = await scanImage(dataUrls[i], (pct) => {
      if (onStatus) {
        onStatus({ current: i + 1, total: dataUrls.length, phase: 'scanning', progress: pct });
      }
    });

    allResults.push({ index: i, rawText: text, parsed: parseScoreboardText(text) });
  }

  if (onStatus) onStatus({ current: dataUrls.length, total: dataUrls.length, phase: 'complete' });
  return allResults;
}

export function parseScoreboardText(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const results = [];

  lines.forEach((line) => {
    const match = line.match(/^(\d{1,2})\s+(.+?)\s+(\d{1,2})$/);
    if (match) {
      results.push({
        placement: parseInt(match[1], 10),
        teamName: match[2].trim(),
        kills: parseInt(match[3], 10),
      });
      return;
    }

    const altMatch = line.match(/(\d{1,2}).*?([A-Za-z][A-Za-z0-9\s_.-]{2,30}).*?(\d{1,2})/);
    if (altMatch) {
      results.push({
        placement: parseInt(altMatch[1], 10),
        teamName: altMatch[2].trim(),
        kills: parseInt(altMatch[3], 10),
      });
    }
  });

  return results;
}

export function matchTeamsToRoster(ocrResults, registeredTeams) {
  return ocrResults.map((ocr) => {
    const normalized = ocr.teamName.toLowerCase().replace(/[^a-z0-9]/g, '');

    let bestMatch = null;
    let bestScore = 0;

    registeredTeams.forEach((team) => {
      const teamNorm = team.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      let score = 0;

      if (teamNorm === normalized) score = 100;
      else if (teamNorm.includes(normalized) || normalized.includes(teamNorm)) score = 70;
      else {
        const words = team.name.toLowerCase().split(/\s+/);
        words.forEach((w) => {
          if (normalized.includes(w.replace(/[^a-z0-9]/g, ''))) score += 20;
        });
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = team;
      }
    });

    return {
      ...ocr,
      teamId: bestMatch?._id || null,
      matchedTeamName: bestMatch?.name || ocr.teamName,
      matchConfidence: bestScore,
    };
  });
}
