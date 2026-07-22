/**
 * API base URL resolution:
 * - Local dev: empty -> `/api` (Vite proxy to backend)
 * - VPS/production: set VITE_API_BASE_URL=http://<IP>:5001/api
 */
const envBase = import.meta.env.VITE_API_BASE_URL;

function resolveApiBase() {
  if (envBase) {
    return envBase.replace(/\/$/, '');
  }
  return '/api';
}

export const API_BASE = resolveApiBase();

export function resolveAssetUrl(path) {
  if (!path) return '';
  if (path.startsWith('data:') || path.startsWith('http')) return path;
  const origin = envBase ? envBase.replace(/\/api\/?$/, '') : '';
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

function getToken() {
  return localStorage.getItem('ap_token');
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = `${API_BASE}${path}`;

  let res;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (err) {
    throw new Error(
      `Network error: cannot reach API at ${API_BASE}. ` +
      (err.message || 'Check VITE_API_BASE_URL and backend status.')
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || `Request failed (${res.status})`);
  return data;
}

async function uploadRequest(path, formData) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = `${API_BASE}${path}`;
  const res = await fetch(url, { method: 'POST', headers, body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
  return data;
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
    return uploadRequest('/upload/logo', fd);
  },

  scanOcr: (blob, timeoutMs = 60000) => {
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
        if (!res.ok) return { success: false, error: data.error || `OCR failed (${res.status})`, text: '' };
        return data;
      })
      .catch((err) => {
        clearTimeout(timer);
        const msg = err.name === 'AbortError' ? 'OCR timeout after 60s' : err.message;
        return { success: false, error: msg, text: '' };
      });
  },

  verifyAdminPin: (pin) => request('/admin/verify-pin', { headers: adminHeaders(pin) }),
  getAdminMetrics: (pin) => request('/admin/metrics', { headers: adminHeaders(pin) }),
  resetAllTournaments: (pin) => request('/admin/reset-tournaments', { method: 'POST', headers: adminHeaders(pin) }),
  resetMediaStorage: (pin) => request('/admin/reset-media', { method: 'POST', headers: adminHeaders(pin) }),

  getPublicStandings: (id) => request(`/public/${id}/standings`),
};
