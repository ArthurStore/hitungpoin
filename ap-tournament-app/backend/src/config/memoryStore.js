import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const store = {
  users: [],
  teams: [],
  tournaments: [],
  matches: [],
  analytics: [],
};

async function seedData() {
  if (store.users.length > 0) return;

  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    store.analytics.push({
      _id: uuidv4(),
      date: d.toISOString(),
      newUsers: Math.floor(Math.random() * 5) + 1,
      activeUsers: Math.floor(Math.random() * 15) + 8,
      tournamentsCreated: Math.floor(Math.random() * 3),
      ocrScansProcessed: Math.floor(Math.random() * 12) + 3,
    });
  }

  const hash = await bcrypt.hash('demo1234', 10);
  store.users.push({
    _id: uuidv4(),
    name: 'Demo Organizer',
    email: 'demo@ap.local',
    passwordHash: hash,
    role: 'organizer',
    createdAt: new Date().toISOString(),
  });
}

await seedData();

export const memoryStore = {
  getUsers: () => store.users,
  findUserByEmail: (email) => store.users.find((u) => u.email === email.toLowerCase()),
  findUserById: (id) => store.users.find((u) => u._id === id),
  createUser: (data) => {
    const user = { _id: uuidv4(), ...data, createdAt: new Date().toISOString() };
    store.users.push(user);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let entry = store.analytics.find((a) => a.date === today.toISOString());
    if (entry) entry.newUsers += 1;
    return user;
  },

  getTournaments: (ownerId) =>
    ownerId ? store.tournaments.filter((t) => t.ownerId === ownerId) : store.tournaments,
  getTournament: (id) => store.tournaments.find((t) => t._id === id),
  getTeams: (tournamentId) => store.teams.filter((t) => t.tournamentId === tournamentId),
  getMatches: (tournamentId) =>
    tournamentId ? store.matches.filter((m) => m.tournamentId === tournamentId) : store.matches,

  createTournament: (data) => {
    const tournament = {
      _id: uuidv4(),
      scoringRules: {
        placementPoints: { 1: 12, 2: 9, 3: 8, 4: 7, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1, 11: 0, 12: 0 },
        killPoint: 1,
        booyahBonus: 5,
      },
      ...data,
      status: data.status || 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.tournaments.push(tournament);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let entry = store.analytics.find((a) => a.date === today.toISOString());
    if (entry) entry.tournamentsCreated += 1;
    return tournament;
  },

  updateTournament: (id, data) => {
    const idx = store.tournaments.findIndex((t) => t._id === id);
    if (idx === -1) return null;
    store.tournaments[idx] = { ...store.tournaments[idx], ...data, updatedAt: new Date().toISOString() };
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

  deleteTeamsByTournament: (tournamentId) => {
    store.teams = store.teams.filter((t) => t.tournamentId !== tournamentId);
  },

  createTeams: (teams) => {
    const created = teams.map((t) => ({ _id: uuidv4(), ...t }));
    store.teams.push(...created);
    return created;
  },

  updateTeam: (id, data) => {
    const idx = store.teams.findIndex((t) => t._id === id);
    if (idx === -1) return null;
    store.teams[idx] = { ...store.teams[idx], ...data };
    return store.teams[idx];
  },

  createMatch: (data) => {
    const match = { _id: uuidv4(), status: 'pending', results: [], ...data };
    store.matches.push(match);
    return match;
  },

  updateMatch: (id, data) => {
    const idx = store.matches.findIndex((m) => m._id === id);
    if (idx === -1) return null;
    store.matches[idx] = { ...store.matches[idx], ...data };
    return store.matches[idx];
  },

  findMatch: (tournamentId, matchNumber) =>
    store.matches.find((m) => m.tournamentId === tournamentId && m.matchNumber === matchNumber),

  incrementOcrScans: (count = 1) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const key = today.toISOString();
    let entry = store.analytics.find((a) => a.date === key);
    if (!entry) {
      entry = { _id: uuidv4(), date: key, newUsers: 0, activeUsers: 0, tournamentsCreated: 0, ocrScansProcessed: 0 };
      store.analytics.push(entry);
    }
    entry.ocrScansProcessed += count;
  },

  getAnalytics: () => store.analytics,
  getActiveTournaments: () => store.tournaments.filter((t) => t.status === 'active'),
};
