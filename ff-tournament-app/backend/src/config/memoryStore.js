import { v4 as uuidv4 } from 'uuid';

const store = {
  users: [],
  teams: [],
  tournaments: [],
  matches: [],
  analytics: [],
};

function seedData() {
  if (store.users.length > 0) return;

  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    store.analytics.push({
      _id: uuidv4(),
      date: d.toISOString(),
      newUsers: Math.floor(Math.random() * 8) + 2,
      activeUsers: Math.floor(Math.random() * 20) + 10,
      tournamentsCreated: Math.floor(Math.random() * 3),
      ocrScansProcessed: Math.floor(Math.random() * 15) + 5,
      revenue: Math.floor(Math.random() * 500000) + 100000,
    });
  }

  store.users.push(
    { _id: uuidv4(), username: 'admin_grid', email: 'admin@gridplay.id', role: 'admin' },
    { _id: uuidv4(), username: 'op_rizky', email: 'rizky@gridplay.id', role: 'operator' },
    { _id: uuidv4(), username: 'op_sari', email: 'sari@gridplay.id', role: 'operator' }
  );
}

seedData();

export const memoryStore = {
  getUsers: () => store.users,
  getTeams: (tournamentId) =>
    tournamentId ? store.teams.filter((t) => t.tournamentId === tournamentId) : store.teams,
  getTournaments: () => store.tournaments,
  getTournament: (id) => store.tournaments.find((t) => t._id === id),
  getMatches: (tournamentId) =>
    tournamentId ? store.matches.filter((m) => m.tournamentId === tournamentId) : store.matches,
  getMatch: (id) => store.matches.find((m) => m._id === id),
  getAnalytics: () => store.analytics,

  createTournament: (data) => {
    const tournament = {
      _id: uuidv4(),
      ...data,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.tournaments.push(tournament);
    return tournament;
  },

  updateTournament: (id, data) => {
    const idx = store.tournaments.findIndex((t) => t._id === id);
    if (idx === -1) return null;
    store.tournaments[idx] = {
      ...store.tournaments[idx],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    return store.tournaments[idx];
  },

  deleteTournament: (id) => {
    const idx = store.tournaments.findIndex((t) => t._id === id);
    if (idx === -1) return false;
    store.tournaments.splice(idx, 1);
    store.teams = store.teams.filter((t) => t.tournamentId !== id);
    store.matches = store.matches.filter((m) => m.tournamentId !== id);
    return true;
  },

  createTeams: (teams) => {
    const created = teams.map((t) => ({
      _id: uuidv4(),
      ...t,
      createdAt: new Date().toISOString(),
    }));
    store.teams.push(...created);
    return created;
  },

  createMatch: (data) => {
    const match = {
      _id: uuidv4(),
      status: 'pending',
      results: [],
      ocrProcessed: false,
      screenshots: [],
      ...data,
      createdAt: new Date().toISOString(),
    };
    store.matches.push(match);
    return match;
  },

  updateMatch: (id, data) => {
    const idx = store.matches.findIndex((m) => m._id === id);
    if (idx === -1) return null;
    store.matches[idx] = { ...store.matches[idx], ...data, updatedAt: new Date().toISOString() };
    return store.matches[idx];
  },

  incrementOcrScans: (count = 1) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const key = today.toISOString();
    let entry = store.analytics.find((a) => a.date === key);
    if (!entry) {
      entry = {
        _id: uuidv4(),
        date: key,
        newUsers: 0,
        activeUsers: 0,
        tournamentsCreated: 0,
        ocrScansProcessed: 0,
        revenue: 0,
      };
      store.analytics.push(entry);
    }
    entry.ocrScansProcessed += count;
  },
};
