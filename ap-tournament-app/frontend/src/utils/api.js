/**
 * API base URL:
 * - VITE_API_BASE_URL if set
 * - Vite on :5173/:5174 → same host :5001/api
 * - else /api
 */
const envBase = import.meta.env.VITE_API_BASE_URL;

function resolveApiBase() {
  if (envBase) return envBase.replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;
    if (port === '5174' || port === '5173') {
      return `${protocol}//${hostname}:5001/api`;
    }
  }
  return '/hitungpoin/api';
}

export const API_BASE = resolveApiBase();

/** Public base path when app is served under Nginx sub-path */
export const APP_BASE = '/hitungpoin';

/**
 * Normalize any stored upload URL to a clean relative path:
 * `/uploads/logos/file.ext` (no host, no /hitungpoin prefix).
 */
export function toRelativeUploadPath(path) {
  if (!path || typeof path !== 'string') return '';
  const raw = path.trim();
  if (!raw || raw.startsWith('data:') || raw.startsWith('blob:')) return raw;

  let clean = raw.replace(/\\/g, '/');
  try {
    if (/^https?:\/\//i.test(clean)) {
      clean = new URL(clean).pathname;
    }
  } catch {
    /* keep clean as-is */
  }

  clean = clean.replace(/^\/hitungpoin(?=\/)/i, '');
  clean = clean.replace(/^\/api(?=\/uploads\/)/i, '');

  const idx = clean.toLowerCase().indexOf('/uploads/');
  if (idx !== -1) {
    return clean.slice(idx);
  }
  if (/^uploads\//i.test(clean)) {
    return `/${clean}`;
  }
  return clean.startsWith('/') ? clean : `/${clean}`;
}

/**
 * Browser URL for uploaded assets under Nginx sub-path `/hitungpoin/`.
 * Handles relative paths, bare `uploads/...`, and legacy absolute IP URLs.
 */
export function resolveAssetUrl(path) {
  if (!path || typeof path !== 'string') return '';
  const raw = path.trim();
  if (!raw) return '';
  if (raw.startsWith('data:') || raw.startsWith('blob:')) return raw;

  const relative = toRelativeUploadPath(raw);
  if (!relative || relative.startsWith('data:') || relative.startsWith('blob:')) return relative;

  if (relative.startsWith('/uploads/')) {
    return `${APP_BASE}${relative}`;
  }
  if (relative.startsWith(`${APP_BASE}/`)) return relative;
  if (relative.startsWith('/')) return `${APP_BASE}${relative}`;
  return `${APP_BASE}/${relative}`;
}

function getToken() {
  return localStorage.getItem('ap_token');
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = `${API_BASE}${path}`;
  let res;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (err) {
    throw new Error(`Network error: cannot reach API at ${API_BASE}. ${err.message || ''}`);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || `Request failed (${res.status})`);
  return data;
}

async function uploadRequest(path, formData, timeoutMs = 30000) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
    return data;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Upload timeout');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function adminHeaders(pin) {
  return { 'X-Admin-Pin': pin };
}

export const api = {
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request('/auth/me'),

  getMyTournaments: () => request('/tournaments'),
  getTournament: (id) => request(`/tournaments/${id}`),
  createTournament: (body) => request('/tournaments', { method: 'POST', body: JSON.stringify(body) }),
  updateTournament: (id, body) => request(`/tournaments/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteTournament: (id) => request(`/tournaments/${id}`, { method: 'DELETE' }),
  updateTeams: (id, body) => request(`/tournaments/${id}/teams`, { method: 'PUT', body: JSON.stringify(body) }),
  upsertTeam: (id, body) => request(`/tournaments/${id}/teams/upsert`, { method: 'POST', body: JSON.stringify(body) }),
  renameTeam: (id, teamId, name) => request(`/tournaments/${id}/teams/${teamId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  }),
  getLeaderboard: (id) => request(`/tournaments/${id}/leaderboard`),
  submitMatchResults: (id, body) => request(`/tournaments/${id}/matches/results`, { method: 'POST', body: JSON.stringify(body) }),
  recordOcrScan: (count = 1) => request('/tournaments/ocr-scan', { method: 'POST', body: JSON.stringify({ count }) }),

  uploadLogo: (file) => {
    const fd = new FormData();
    fd.append('logo', file);
    return uploadRequest('/upload/logo', fd, 30000);
  },

  uploadCertificateTemplate: (file) => {
    const fd = new FormData();
    fd.append('template', file);
    return uploadRequest('/upload/certificate', fd, 45000);
  },

  scanOcr: (blob, timeoutMs = 90000, mode = 'cr_biasa') => {
    const fd = new FormData();
    fd.append('image', blob, 'scoreboard.png');
    fd.append('mode', mode || 'cr_biasa');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const headers = {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    return fetch(`${API_BASE}/ocr/scan`, { method: 'POST', headers, body: fd, signal: controller.signal })
      .then(async (res) => {
        clearTimeout(timer);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { success: false, error: data.error || `OCR failed (${res.status})`, text: '', results: data.results || [] };
        return data;
      })
      .catch((err) => {
        clearTimeout(timer);
        const msg = err.name === 'AbortError' ? 'OCR timeout' : err.message;
        return { success: false, error: msg, text: '', results: [] };
      });
  },

  recordManualScan: () => request('/ocr/manual-scan', { method: 'POST', body: JSON.stringify({}) }),

  verifyAdminPin: (pin) => request('/admin/verify-pin', {
    method: 'POST',
    headers: adminHeaders(pin),
    body: JSON.stringify({}),
  }),
  getAdminMetrics: (pin) => request('/admin/metrics', { headers: adminHeaders(pin) }),
  resetAllTournaments: (pin) => request('/admin/reset-tournaments', {
    method: 'POST', headers: adminHeaders(pin), body: JSON.stringify({}),
  }),
  resetMediaStorage: (pin) => request('/admin/reset-media', {
    method: 'POST', headers: adminHeaders(pin), body: JSON.stringify({}),
  }),
  updateGeminiKey: (pin, apiKeyOrKeys) => {
    const body = Array.isArray(apiKeyOrKeys)
      ? { keys: apiKeyOrKeys }
      : (typeof apiKeyOrKeys === 'object' && apiKeyOrKeys != null
        ? apiKeyOrKeys
        : { apiKey: apiKeyOrKeys || '' });
    return request('/admin/gemini-key', {
      method: 'POST', headers: adminHeaders(pin), body: JSON.stringify(body),
    });
  },
  testGemini: (pin, apiKey) => request('/admin/gemini-test', {
    method: 'POST', headers: adminHeaders(pin), body: JSON.stringify({ apiKey: apiKey || undefined }),
  }),
  testGeminiImage: async (pin, file) => {
    const fd = new FormData();
    fd.append('image', file);
    const headers = { ...adminHeaders(pin) };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/admin/gemini-test-image`, { method: 'POST', headers, body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Test failed (${res.status})`);
    return data;
  },

  getPublicStandings: (id) => request(`/public/${id}/standings`),
};
