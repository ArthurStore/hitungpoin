import { isMemoryStore } from '../config/database.js';
import { memoryStore } from '../config/memoryStore.js';
import User from '../models/User.js';
import Tournament from '../models/Tournament.js';
import Match from '../models/Match.js';

export async function getAdminMetrics(req, res) {
  try {
    if (isMemoryStore()) {
      const analytics = memoryStore.getAnalytics();
      const users = memoryStore.getUsers();
      const tournaments = memoryStore.getTournaments();
      const active = memoryStore.getActiveTournaments();
      const totalScans = analytics.reduce((s, a) => s + (a.ocrScansProcessed || 0), 0);

      const chartData = analytics
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(-14)
        .map((a) => ({
          date: a.date.split('T')[0],
          users: a.activeUsers,
          scans: a.ocrScansProcessed,
          tournaments: a.tournamentsCreated,
        }));

      return res.json({
        totalUsers: users.length,
        activeTournaments: active.length,
        totalTournaments: tournaments.length,
        totalScans,
        chartData,
      });
    }

    const [totalUsers, totalTournaments, activeTournaments] = await Promise.all([
      User.countDocuments(),
      Tournament.countDocuments(),
      Tournament.countDocuments({ status: 'active' }),
    ]);

    const matches = await Match.find({ ocrProcessed: true });
    const totalScans = matches.length;

    res.json({
      totalUsers,
      activeTournaments,
      totalTournaments,
      totalScans,
      chartData: [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function verifyAdminPin(req, res) {
  res.json({ valid: true });
}
