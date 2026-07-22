import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SETTINGS_PATH = path.join(__dirname, '../../data/settings.json');

const defaultSettings = {
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: 'gemini-flash-latest',
  geminiDailyUsage: 0,
  geminiDailyDate: '',
  geminiLastLatencyMs: null,
  geminiLastStatus: 'unknown',
  geminiLastError: '',
  scansAi: 0,
  scansManual: 0,
};

function ensureDir() {
  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function loadSettings() {
  ensureDir();
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const raw = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
      return { ...defaultSettings, ...raw };
    }
  } catch { /* ignore */ }
  const seed = { ...defaultSettings };
  saveSettings(seed);
  return seed;
}

export function saveSettings(partial) {
  ensureDir();
  const current = (() => {
    try {
      if (fs.existsSync(SETTINGS_PATH)) {
        return { ...defaultSettings, ...JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')) };
      }
    } catch { /* ignore */ }
    return { ...defaultSettings };
  })();
  const next = { ...current, ...partial };
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2));
  return next;
}

export function getGeminiApiKey() {
  const s = loadSettings();
  return s.geminiApiKey || process.env.GEMINI_API_KEY || '';
}

export function bumpGeminiUsage(latencyMs, ok, error = '') {
  const s = loadSettings();
  const today = new Date().toISOString().slice(0, 10);
  let daily = s.geminiDailyUsage || 0;
  if (s.geminiDailyDate !== today) daily = 0;
  return saveSettings({
    geminiDailyUsage: daily + 1,
    geminiDailyDate: today,
    geminiLastLatencyMs: latencyMs,
    geminiLastStatus: ok ? 'ok' : 'error',
    geminiLastError: error || '',
    scansAi: (s.scansAi || 0) + (ok ? 1 : 0),
  });
}

export function bumpManualScan() {
  const s = loadSettings();
  return saveSettings({ scansManual: (s.scansManual || 0) + 1 });
}
