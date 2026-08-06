import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SETTINGS_PATH = path.join(__dirname, '../../data/settings.json');

const defaultSettings = {
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiApiKeys: ['', '', ''],
  geminiKeyIndex: 0,
  geminiModel: 'gemini-flash-latest',
  geminiDailyUsage: 0,
  geminiDailyDate: '',
  geminiLastLatencyMs: null,
  geminiLastStatus: 'unknown',
  geminiLastError: '',
  geminiLastKeySlot: null,
  scansAi: 0,
  scansManual: 0,
};

function ensureDir() {
  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function migrateModel(model) {
  const m = (model || '').trim();
  if (!m || /^gemini-(1\.0|1\.5|2\.0|2\.5)(-|$)/i.test(m) || m === 'gemini-pro' || m === 'gemini-flash') {
    return 'gemini-flash-latest';
  }
  return m;
}

function normalizeKeys(settings) {
  let keys = Array.isArray(settings.geminiApiKeys) ? [...settings.geminiApiKeys] : ['', '', ''];
  while (keys.length < 3) keys.push('');
  keys = keys.slice(0, 3).map((k) => (typeof k === 'string' ? k.trim() : ''));

  // Migrate legacy single key into slot 1
  const legacy = (settings.geminiApiKey || process.env.GEMINI_API_KEY || '').trim();
  if (legacy && !keys.some((k) => k === legacy)) {
    if (!keys[0]) keys[0] = legacy;
    else if (!keys[1]) keys[1] = legacy;
    else if (!keys[2]) keys[2] = legacy;
  }

  return {
    ...settings,
    geminiApiKeys: keys,
    geminiApiKey: keys.find(Boolean) || legacy || '',
  };
}

export function loadSettings() {
  ensureDir();
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const raw = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
      let merged = normalizeKeys({ ...defaultSettings, ...raw });
      const fixedModel = migrateModel(merged.geminiModel);
      if (fixedModel !== merged.geminiModel) {
        merged.geminiModel = fixedModel;
      }
      try {
        fs.writeFileSync(SETTINGS_PATH, JSON.stringify(merged, null, 2));
      } catch { /* ignore */ }
      return merged;
    }
  } catch { /* ignore */ }
  const seed = normalizeKeys({ ...defaultSettings });
  saveSettings(seed);
  return seed;
}

export function saveSettings(partial) {
  ensureDir();
  const current = (() => {
    try {
      if (fs.existsSync(SETTINGS_PATH)) {
        return normalizeKeys({ ...defaultSettings, ...JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')) });
      }
    } catch { /* ignore */ }
    return normalizeKeys({ ...defaultSettings });
  })();
  const next = normalizeKeys({ ...current, ...partial });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2));

  // Persist keys to .env so PM2 restart keeps them
  if (partial.geminiApiKeys != null || partial.geminiApiKey != null) {
    persistGeminiKeysToEnv(next.geminiApiKeys);
  }

  // Keep process.env in sync for current process
  const primary = (next.geminiApiKeys || []).find(Boolean) || next.geminiApiKey || '';
  if (primary) process.env.GEMINI_API_KEY = primary;

  return next;
}

const ENV_PATH = path.join(__dirname, '../../.env');

function persistGeminiKeysToEnv(keys = []) {
  try {
    const primary = (keys || []).map((k) => String(k || '').trim()).find(Boolean) || '';
    const k1 = String(keys[0] || '').trim();
    const k2 = String(keys[1] || '').trim();
    const k3 = String(keys[2] || '').trim();

    let content = '';
    if (fs.existsSync(ENV_PATH)) {
      content = fs.readFileSync(ENV_PATH, 'utf8');
    }

    const upsert = (src, key, value) => {
      const re = new RegExp(`^${key}=.*$`, 'm');
      const line = `${key}=${value}`;
      if (re.test(src)) return src.replace(re, line);
      return `${src.trimEnd()}\n${line}\n`;
    };

    let next = content || '';
    next = upsert(next, 'GEMINI_API_KEY', primary);
    next = upsert(next, 'GEMINI_API_KEY_1', k1);
    next = upsert(next, 'GEMINI_API_KEY_2', k2);
    next = upsert(next, 'GEMINI_API_KEY_3', k3);
    fs.writeFileSync(ENV_PATH, next.endsWith('\n') ? next : `${next}\n`);
  } catch (err) {
    console.warn('[settings] gagal tulis .env:', err.message);
  }
}

/** Bootstrap keys from .env slots on server start */
export function hydrateGeminiKeysFromEnv() {
  const envKeys = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
  ].map((k) => (k || '').trim());
  const primary = (process.env.GEMINI_API_KEY || '').trim();
  if (!primary && !envKeys.some(Boolean)) {
    // still load settings.json
    return loadSettings();
  }

  const s = loadSettings();
  const existing = s.geminiApiKeys || ['', '', ''];
  const merged = [
    existing[0] || envKeys[0] || primary || '',
    existing[1] || envKeys[1] || '',
    existing[2] || envKeys[2] || '',
  ];
  // If settings empty but env has keys, persist into settings.json
  if (!existing.some(Boolean) && merged.some(Boolean)) {
    return saveSettings({ geminiApiKeys: merged, geminiApiKey: merged.find(Boolean) || '' });
  }
  if (primary && !process.env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = merged.find(Boolean) || primary;
  }
  return s;
}

/** All non-empty API keys with slot index (0-based) */
export function getGeminiApiKeys() {
  const s = loadSettings();
  const keys = (s.geminiApiKeys || []).map((k, i) => ({ slot: i, key: (k || '').trim() })).filter((x) => x.key);
  if (!keys.length) {
    const env = (process.env.GEMINI_API_KEY || '').trim();
    if (env) return [{ slot: 0, key: env }];
  }
  return keys;
}

export function getGeminiApiKey() {
  const keys = getGeminiApiKeys();
  return keys[0]?.key || '';
}

/**
 * Round-robin next key. Advances geminiKeyIndex.
 * @returns {{ key: string, slot: number } | null}
 */
export function pickNextGeminiKey() {
  const keys = getGeminiApiKeys();
  if (!keys.length) return null;
  const s = loadSettings();
  const start = (s.geminiKeyIndex || 0) % keys.length;
  const chosen = keys[start];
  saveSettings({ geminiKeyIndex: (start + 1) % keys.length, geminiLastKeySlot: chosen.slot + 1 });
  return chosen;
}

/** Ordered list starting after last used, for fallback retries */
export function getGeminiKeyRotationOrder() {
  const keys = getGeminiApiKeys();
  if (!keys.length) return [];
  const s = loadSettings();
  const start = (s.geminiKeyIndex || 0) % keys.length;
  const ordered = [];
  for (let i = 0; i < keys.length; i += 1) {
    ordered.push(keys[(start + i) % keys.length]);
  }
  // Advance RR pointer for next request
  saveSettings({ geminiKeyIndex: (start + 1) % keys.length });
  return ordered;
}

export function bumpGeminiUsage(latencyMs, ok, error = '', keySlot = null) {
  const s = loadSettings();
  const today = new Date().toISOString().slice(0, 10);
  let daily = s.geminiDailyUsage || 0;
  if (s.geminiDailyDate !== today) daily = 0;
  const patch = {
    geminiDailyUsage: daily + 1,
    geminiDailyDate: today,
    geminiLastLatencyMs: latencyMs,
    geminiLastStatus: ok ? 'ok' : 'error',
    geminiLastError: error || '',
    scansAi: (s.scansAi || 0) + (ok ? 1 : 0),
  };
  if (keySlot != null) patch.geminiLastKeySlot = keySlot;
  return saveSettings(patch);
}

export function bumpManualScan() {
  const s = loadSettings();
  return saveSettings({ scansManual: (s.scansManual || 0) + 1 });
}
