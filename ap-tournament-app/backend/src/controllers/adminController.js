import { isMemoryStore } from '../config/database.js';
import { memoryStore } from '../config/memoryStore.js';
import { clearMediaStorage } from '../config/upload.js';
import {
  loadSettings, saveSettings, getGeminiApiKey, getGeminiApiKeys,
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

    const keys = getGeminiApiKeys();
    const hasKey = keys.length > 0 || !!getGeminiApiKey();
    const allKeys = settings.geminiApiKeys || ['', '', ''];
    res.json({
      ...base,
      scansAi: settings.scansAi || 0,
      scansManual: settings.scansManual || 0,
      gemini: {
        configured: hasKey,
        maskedKey: maskKey(allKeys.find(Boolean) || process.env.GEMINI_API_KEY || ''),
        /** Plaintext keys for admin editing (PIN-gated endpoint) */
        keys: [allKeys[0] || '', allKeys[1] || '', allKeys[2] || ''],
        activeSlots: keys.map((k) => k.slot + 1),
        lastKeySlot: settings.geminiLastKeySlot || null,
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
    const body = req.body || {};
    let keys = ['', '', ''];

    if (Array.isArray(body.keys)) {
      keys = [0, 1, 2].map((i) => String(body.keys[i] || '').trim());
    } else if (typeof body.apiKey === 'string') {
      // legacy single-key
      keys[0] = body.apiKey.trim();
      const current = loadSettings().geminiApiKeys || ['', '', ''];
      keys[1] = current[1] || '';
      keys[2] = current[2] || '';
    } else if (body.key1 != null || body.key2 != null || body.key3 != null) {
      keys = [
        String(body.key1 || '').trim(),
        String(body.key2 || '').trim(),
        String(body.key3 || '').trim(),
      ];
    } else {
      return res.status(400).json({ error: 'keys array or apiKey required' });
    }

    const settings = saveSettings({
      geminiApiKeys: keys,
      geminiApiKey: keys.find(Boolean) || '',
      geminiModel: 'gemini-flash-latest',
      geminiLastStatus: keys.some(Boolean) ? 'updated' : 'missing',
      geminiLastError: '',
    });

    res.json({
      ok: true,
      configured: keys.some(Boolean),
      keys: settings.geminiApiKeys,
      maskedKey: maskKey(settings.geminiApiKeys.find(Boolean) || ''),
      model: settings.geminiModel,
      activeSlots: getGeminiApiKeys().map((k) => k.slot + 1),
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
