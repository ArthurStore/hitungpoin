import { isMemoryStore } from '../config/database.js';
import { memoryStore } from '../config/memoryStore.js';
import { clearMediaStorage } from '../config/upload.js';
import {
  loadSettings, saveSettings, getGeminiApiKey,
} from '../config/settingsStore.js';
import { testGeminiConnection, runGeminiVisionOcr } from '../services/geminiOcr.js';
import User from '../models/User.js';
import Tournament from '../models/Tournament.js';
import Team from '../models/Team.js';
import Match from '../models/Match.js';

function maskKey(key) {
  if (!key) return '';
  if (key.length < 8) return '****';
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

export async function getAdminMetrics(req, res) {
  try {
    const settings = loadSettings();
    let base = {
      totalUsers: 0,
      activeTournaments: 0,
      totalTournaments: 0,
      totalScans: 0,
      chartData: [],
    };

    if (isMemoryStore()) {
      const analytics = memoryStore.getAnalytics();
      const users = memoryStore.getUsers();
      const tournaments = memoryStore.getTournaments();
      const active = memoryStore.getActiveTournaments();
      const totalScans = analytics.reduce((s, a) => s + (a.ocrScansProcessed || 0), 0)
        + (settings.scansAi || 0) + (settings.scansManual || 0);

      base = {
        totalUsers: users.length,
        activeTournaments: active.length,
        totalTournaments: tournaments.length,
        totalScans,
        chartData: analytics
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .slice(-14)
          .map((a) => ({
            date: a.date.split('T')[0],
            users: a.activeUsers,
            scans: a.ocrScansProcessed,
            tournaments: a.tournamentsCreated,
          })),
      };
    } else {
      const [totalUsers, totalTournaments, activeTournaments, ocrMatches] = await Promise.all([
        User.countDocuments(),
        Tournament.countDocuments(),
        Tournament.countDocuments({ status: 'active' }),
        Match.countDocuments({ ocrProcessed: true }),
      ]);
      base = {
        totalUsers,
        activeTournaments,
        totalTournaments,
        totalScans: ocrMatches + (settings.scansAi || 0) + (settings.scansManual || 0),
        chartData: [],
      };
    }

    const hasKey = !!getGeminiApiKey();
    res.json({
      ...base,
      scansAi: settings.scansAi || 0,
      scansManual: settings.scansManual || 0,
      gemini: {
        configured: hasKey,
        maskedKey: maskKey(settings.geminiApiKey || process.env.GEMINI_API_KEY || ''),
        model: settings.geminiModel || 'gemini-flash-latest',
        dailyUsage: settings.geminiDailyUsage || 0,
        dailyDate: settings.geminiDailyDate || '',
        lastLatencyMs: settings.geminiLastLatencyMs,
        lastStatus: settings.geminiLastStatus || (hasKey ? 'idle' : 'missing'),
        lastError: settings.geminiLastError || '',
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function verifyAdminPin(req, res) {
  res.json({ valid: true });
}

export async function resetAllTournaments(req, res) {
  try {
    if (isMemoryStore()) {
      const count = memoryStore.resetAllTournaments();
      return res.json({ message: `Reset ${count} tournaments`, count });
    }
    const tournamentCount = await Tournament.countDocuments();
    await Promise.all([Match.deleteMany({}), Team.deleteMany({}), Tournament.deleteMany({})]);
    res.json({ message: `Reset ${tournamentCount} tournaments`, count: tournamentCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function resetMediaStorage(req, res) {
  try {
    const deletedFiles = clearMediaStorage();
    if (isMemoryStore()) {
      memoryStore.resetMediaStorage();
    } else {
      await Tournament.updateMany(
        { $or: [{ logo: { $regex: '^/uploads/' } }, { certificateTemplate: { $regex: '^/uploads/' } }] },
        { $set: { logo: '', certificateTemplate: '' } }
      );
    }
    res.json({ message: `Cleared ${deletedFiles} media files`, count: deletedFiles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateGeminiKey(req, res) {
  try {
    const { apiKey } = req.body || {};
    if (typeof apiKey !== 'string') {
      return res.status(400).json({ error: 'apiKey string required' });
    }
    const trimmed = apiKey.trim();
    const settings = saveSettings({
      geminiApiKey: trimmed,
      geminiModel: 'gemini-flash-latest',
      geminiLastStatus: trimmed ? 'updated' : 'missing',
      geminiLastError: '',
    });
    res.json({
      ok: true,
      configured: !!trimmed,
      maskedKey: maskKey(trimmed),
      model: settings.geminiModel,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function testGemini(req, res) {
  try {
    const { apiKey } = req.body || {};
    const result = await testGeminiConnection(apiKey || undefined);
    if (result.ok) {
      saveSettings({
        geminiLastLatencyMs: result.latencyMs,
        geminiLastStatus: 'ok',
        geminiLastError: '',
      });
    } else {
      saveSettings({
        geminiLastLatencyMs: result.latencyMs,
        geminiLastStatus: 'error',
        geminiLastError: result.error || 'test failed',
      });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function testGeminiImage(req, res) {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'No image uploaded' });
    const result = await runGeminiVisionOcr(req.file.buffer, req.file.mimetype || 'image/png');
    res.json({
      ok: result.success,
      ...result,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
