import { isMemoryStore } from '../config/database.js';
import { memoryStore } from '../config/memoryStore.js';
import Match from '../models/Match.js';
import Analytics from '../models/Analytics.js';
import User from '../models/User.js';
import Tournament from '../models/Tournament.js';

export async function getDashboardMetrics(req, res) {
  try {
    if (isMemoryStore()) {
      const users = memoryStore.getUsers();
      const tournaments = memoryStore.getTournaments();
      const analytics = memoryStore.getAnalytics();
      const totalScans = analytics.reduce((s, a) => s + (a.ocrScansProcessed || 0), 0);
      const totalRevenue = analytics.reduce((s, a) => s + (a.revenue || 0), 0);

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
        totalTournaments: tournaments.length,
        totalScans,
        estimatedRevenue: totalRevenue,
        chartData,
      });
    }

    const [totalUsers, totalTournaments, analytics] = await Promise.all([
      User.countDocuments(),
      Tournament.countDocuments(),
      Analytics.find().sort({ date: 1 }).limit(14),
    ]);

    const totalScans = analytics.reduce((s, a) => s + (a.ocrScansProcessed || 0), 0);
    const totalRevenue = analytics.reduce((s, a) => s + (a.revenue || 0), 0);

    const chartData = analytics.map((a) => ({
      date: a.date.toISOString().split('T')[0],
      users: a.activeUsers,
      scans: a.ocrScansProcessed,
      tournaments: a.tournamentsCreated,
    }));

    res.json({
      totalUsers,
      totalTournaments,
      totalScans,
      estimatedRevenue: totalRevenue,
      chartData,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function recordOcrScan(req, res) {
  try {
    const count = req.body.count || 1;
    if (isMemoryStore()) {
      memoryStore.incrementOcrScans(count);
      return res.json({ message: 'OCR scan recorded' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await Analytics.findOneAndUpdate(
      { date: today },
      { $inc: { ocrScansProcessed: count } },
      { upsert: true, new: true }
    );
    res.json({ message: 'OCR scan recorded' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getMatches(req, res) {
  try {
    const { tournamentId } = req.query;
    if (isMemoryStore()) {
      return res.json(memoryStore.getMatches(tournamentId));
    }
    const filter = tournamentId ? { tournamentId } : {};
    const matches = await Match.find(filter).sort({ matchNumber: 1 });
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
