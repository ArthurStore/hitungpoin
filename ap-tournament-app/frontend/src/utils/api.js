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
  return '/api';
}

export const API_BASE = resolveApiBase();

export function resolveAssetUrl(path) {
  if (!path) return '';
  if (path.startsWith('data:') || path.startsWith('http') || path.startsWith('blob:')) return path;
  const origin = API_BASE.replace(/\/api\/?$/, '');
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
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

  scanOcr: (blob, timeoutMs = 90000) => {
    const fd = new FormData();
    fd.append('image', blob, 'scoreboard.png');
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
  updateGeminiKey: (pin, apiKey) => request('/admin/gemini-key', {
    method: 'POST', headers: adminHeaders(pin), body: JSON.stringify({ apiKey }),
  }),
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
