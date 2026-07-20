const API_BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  health: () => request('/health'),
  getDashboard: () => request('/analytics/dashboard'),
  recordOcrScan: (count = 1) =>
    request('/analytics/ocr-scan', { method: 'POST', body: JSON.stringify({ count }) }),
  getTournaments: () => request('/tournaments'),
  getTournament: (id) => request(`/tournaments/${id}`),
  createTournament: (data) =>
    request('/tournaments', { method: 'POST', body: JSON.stringify(data) }),
  updateTournament: (id, data) =>
    request(`/tournaments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTournament: (id) => request(`/tournaments/${id}`, { method: 'DELETE' }),
  getLeaderboard: (id) => request(`/tournaments/${id}/leaderboard`),
  submitMatchResults: (id, data) =>
    request(`/tournaments/${id}/matches/results`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
