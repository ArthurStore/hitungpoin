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
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
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

  verifyAdminPin: (pin) => request('/admin/verify-pin', { headers: { 'X-Admin-Pin': pin } }),
  getAdminMetrics: (pin) => request('/admin/metrics', { headers: { 'X-Admin-Pin': pin } }),

  getPublicStandings: (id) => request(`/public/${id}/standings`),
};
