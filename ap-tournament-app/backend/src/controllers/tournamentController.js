import { isMemoryStore } from '../config/database.js';
import { memoryStore } from '../config/memoryStore.js';
import Tournament from '../models/Tournament.js';
import Team from '../models/Team.js';
import Match from '../models/Match.js';
import { calcMatchPoints, aggregateStandings, parseRosterInput, MAPS } from '../utils/pointsCalc.js';
import { emitLeaderboardUpdate } from '../socket.js';

function buildMatchConfigs(totalMatches, matchConfigs) {
  if (matchConfigs?.length) return matchConfigs;
  return Array.from({ length: totalMatches || 6 }, (_, i) => ({
    matchNumber: i + 1,
    map: MAPS[i % MAPS.length],
  }));
}

async function broadcastStandings(tournamentId) {
  try {
    let tournament;
    let standings;
    let matches;
    if (isMemoryStore()) {
      tournament = memoryStore.getTournament(tournamentId);
      matches = memoryStore.getMatches(tournamentId);
      standings = aggregateStandings(matches, memoryStore.getTeams(tournamentId));
    } else {
      tournament = await Tournament.findById(tournamentId).lean();
      const teams = await Team.find({ tournamentId });
      matches = await Match.find({ tournamentId });
      standings = aggregateStandings(matches, teams);
    }
    if (!tournament) return;
    emitLeaderboardUpdate(tournamentId, {
      tournament: {
        _id: tournament._id,
        name: tournament.name,
        logo: tournament.logo,
        format: tournament.format,
        status: tournament.status,
        totalMatches: tournament.totalMatches,
        inputMode: tournament.inputMode,
        leaderboardSubtitle: tournament.leaderboardSubtitle,
      },
      standings,
      matches,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('broadcastStandings', err.message);
  }
}

export async function listMyTournaments(req, res) {
  try {
    const ownerId = req.user._id;
    if (isMemoryStore()) {
      return res.json(memoryStore.getTournaments(ownerId));
    }
    const tournaments = await Tournament.find({ ownerId }).sort({ createdAt: -1 });
    res.json(tournaments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getTournament(req, res) {
  try {
    const { id } = req.params;
    if (isMemoryStore()) {
      const t = memoryStore.getTournament(id);
      if (!t) return res.status(404).json({ error: 'Tournament not found' });
      return res.json({
        ...t,
        teams: memoryStore.getTeams(id),
        matches: memoryStore.getMatches(id),
      });
    }
    const tournament = await Tournament.findById(id).populate('teams');
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    const matches = await Match.find({ tournamentId: id }).sort({ matchNumber: 1 });
    res.json({ ...tournament.toObject(), matches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function createTournament(req, res) {
  try {
    const ownerId = req.user._id;
    const {
      name, logo, format, inputMode, targetPoints, totalMatches,
      matchConfigs, rosterText, teams: teamsInput, scoringRules,
    } = req.body;

    const parsedTeams = rosterText ? parseRosterInput(rosterText) : teamsInput || [];
    const configs = buildMatchConfigs(totalMatches, matchConfigs);
    const rules = scoringRules || {
      placementPoints: { 1: 12, 2: 9, 3: 8, 4: 7, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1, 11: 0, 12: 0 },
      killPoint: 1,
      booyahBonus: 5,
    };

    if (isMemoryStore()) {
      const tournament = memoryStore.createTournament({
        name, logo, format: format || 'One Day', inputMode: inputMode || 'cr_biasa',
        targetPoints: targetPoints || 80, totalMatches: configs.length,
        matchConfigs: configs, ownerId, status: 'active', scoringRules: rules,
      });
      const teams = memoryStore.createTeams(parsedTeams.map((t) => ({ ...t, tournamentId: tournament._id })));
      configs.forEach((cfg) => {
        memoryStore.createMatch({ tournamentId: tournament._id, matchNumber: cfg.matchNumber, map: cfg.map });
      });
      return res.status(201).json({ ...tournament, teams, matches: memoryStore.getMatches(tournament._id) });
    }

    const tournament = await Tournament.create({
      name, logo, format, inputMode, targetPoints, totalMatches: configs.length,
      matchConfigs: configs, ownerId, status: 'active', scoringRules: rules,
    });
    const teams = await Team.insertMany(parsedTeams.map((t) => ({ ...t, tournamentId: tournament._id })));
    tournament.teams = teams.map((t) => t._id);
    await tournament.save();
    await Match.insertMany(configs.map((c) => ({ tournamentId: tournament._id, matchNumber: c.matchNumber, map: c.map })));
    const matches = await Match.find({ tournamentId: tournament._id });
    res.status(201).json({ ...tournament.toObject(), teams, matches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateTournament(req, res) {
  try {
    const { id } = req.params;
    const { totalMatches, matchConfigs, ...rest } = req.body;

    if (isMemoryStore()) {
      const existing = memoryStore.getTournament(id);
      if (!existing) return res.status(404).json({ error: 'Not found' });

      const nextTotal = totalMatches ?? existing.totalMatches;
      const configs = buildMatchConfigs(nextTotal, matchConfigs || existing.matchConfigs);
      const updated = memoryStore.updateTournament(id, {
        ...rest,
        totalMatches: nextTotal,
        matchConfigs: configs,
      });
      const matches = memoryStore.syncMatches(id, nextTotal, configs);
      return res.json({ ...updated, matches });
    }

    const existing = await Tournament.findById(id);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const nextTotal = totalMatches ?? existing.totalMatches;
    const configs = buildMatchConfigs(nextTotal, matchConfigs || existing.matchConfigs);

    const tournament = await Tournament.findByIdAndUpdate(
      id,
      { ...rest, totalMatches: nextTotal, matchConfigs: configs },
      { new: true }
    );

    await Match.deleteMany({ tournamentId: id, matchNumber: { $gt: nextTotal } });
    for (const cfg of configs) {
      await Match.findOneAndUpdate(
        { tournamentId: id, matchNumber: cfg.matchNumber },
        { $setOnInsert: { tournamentId: id, matchNumber: cfg.matchNumber, status: 'pending', results: [] }, $set: { map: cfg.map } },
        { upsert: true, new: true }
      );
    }
    const matches = await Match.find({ tournamentId: id }).sort({ matchNumber: 1 });
    res.json({ ...tournament.toObject(), matches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateTeams(req, res) {
  try {
    const { id } = req.params;
    const { rosterText } = req.body;
    const parsed = parseRosterInput(rosterText || '');

    if (isMemoryStore()) {
      memoryStore.deleteTeamsByTournament(id);
      const teams = memoryStore.createTeams(parsed.map((t) => ({ ...t, tournamentId: id })));
      memoryStore.updateTournament(id, { teams: teams.map((t) => t._id) });
      return res.json(teams);
    }

    await Team.deleteMany({ tournamentId: id });
    const teams = await Team.insertMany(parsed.map((t) => ({ ...t, tournamentId: id })));
    await Tournament.findByIdAndUpdate(id, { teams: teams.map((t) => t._id) });
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/** Create or update a single team with roster (OCR smart provisioning).
 *  Supports merge:true to union nicknames into existing roster (max 6). */
export async function upsertTeam(req, res) {
  try {
    const { id } = req.params;
    const { name, players = [], representative, teamId, merge = true } = req.body || {};
    const teamName = String(name || '').trim();
    if (!teamName) return res.status(400).json({ error: 'Nama tim wajib diisi' });

    const MAX_ROSTER = 6;
    const incoming = (Array.isArray(players) ? players : [])
      .map((p) => (typeof p === 'string' ? { nickname: p.trim() } : { nickname: String(p.nickname || p.name || '').trim() }))
      .filter((p) => p.nickname);

    const mergeRosters = (existing = [], next = []) => {
      const map = new Map();
      [...existing, ...next].forEach((p) => {
        const nick = String(p.nickname || p.name || p || '').trim();
        if (!nick) return;
        const key = nick.toLowerCase();
        if (!map.has(key)) map.set(key, { nickname: nick });
      });
      return Array.from(map.values()).slice(0, MAX_ROSTER);
    };

    if (isMemoryStore()) {
      let existing = null;
      if (teamId) existing = memoryStore.getTeams(id).find((t) => t._id === teamId) || null;
      if (!existing) {
        existing = memoryStore.getTeams(id).find(
          (t) => t.name.toLowerCase() === teamName.toLowerCase()
        ) || null;
      }
      const roster = merge && existing
        ? mergeRosters(existing.players || [], incoming)
        : incoming.slice(0, MAX_ROSTER);
      const rep = representative || roster[0]?.nickname || existing?.representative || '';

      let team;
      if (existing) {
        team = memoryStore.updateTeam(existing._id, { name: teamName, players: roster, representative: rep });
      } else {
        [team] = memoryStore.createTeams([{
          name: teamName, players: roster, representative: rep, tournamentId: id,
        }]);
        const t = memoryStore.getTournament(id);
        memoryStore.updateTournament(id, { teams: [...(t.teams || []), team._id] });
      }
      // Sync nama di hasil match + live broadcast
      const matches = memoryStore.getMatches(id);
      matches.forEach((m) => {
        const results = (m.results || []).map((r) =>
          String(r.teamId) === String(team._id) ? { ...r, teamName } : r
        );
        memoryStore.updateMatch(m._id, { results });
      });
      await broadcastStandings(id);
      return res.json(team);
    }

    let existing = null;
    if (teamId) {
      existing = await Team.findOne({ _id: teamId, tournamentId: id });
    }
    if (!existing) {
      existing = await Team.findOne({
        tournamentId: id,
        name: new RegExp(`^${teamName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      });
    }

    const roster = merge && existing
      ? mergeRosters(existing.players || [], incoming)
      : incoming.slice(0, MAX_ROSTER);
    const rep = representative || roster[0]?.nickname || existing?.representative || '';

    let team;
    if (existing) {
      existing.name = teamName;
      existing.players = roster;
      existing.representative = rep;
      await existing.save();
      team = existing;
    } else {
      team = await Team.create({
        name: teamName, players: roster, representative: rep, tournamentId: id,
      });
      await Tournament.findByIdAndUpdate(id, { $addToSet: { teams: team._id } });
    }

    const matches = await Match.find({ tournamentId: id });
    await Promise.all(matches.map(async (m) => {
      let changed = false;
      (m.results || []).forEach((r) => {
        if (String(r.teamId) === String(team._id) && r.teamName !== teamName) {
          r.teamName = teamName;
          changed = true;
        }
      });
      if (changed) {
        m.markModified('results');
        await m.save();
      }
    }));
    await broadcastStandings(id);
    res.json(team);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/** Rename team + sync teamName in all match results + broadcast live */
export async function renameTeam(req, res) {
  try {
    const { id, teamId } = req.params;
    const teamName = String(req.body?.name || '').trim();
    if (!teamName) return res.status(400).json({ error: 'Nama tim wajib diisi' });

    if (isMemoryStore()) {
      const team = memoryStore.updateTeam(teamId, { name: teamName });
      if (!team || team.tournamentId !== id) return res.status(404).json({ error: 'Tim tidak ditemukan' });

      const matches = memoryStore.getMatches(id);
      matches.forEach((m) => {
        const results = (m.results || []).map((r) =>
          String(r.teamId) === String(teamId) ? { ...r, teamName } : r
        );
        memoryStore.updateMatch(m._id, { results });
      });

      await broadcastStandings(id);
      return res.json(team);
    }

    const team = await Team.findOneAndUpdate(
      { _id: teamId, tournamentId: id },
      { name: teamName },
      { new: true }
    );
    if (!team) return res.status(404).json({ error: 'Tim tidak ditemukan' });

    const matches = await Match.find({ tournamentId: id });
    await Promise.all(matches.map(async (m) => {
      let changed = false;
      (m.results || []).forEach((r) => {
        if (String(r.teamId) === String(teamId) && r.teamName !== teamName) {
          r.teamName = teamName;
          changed = true;
        }
      });
      if (changed) {
        m.markModified('results');
        await m.save();
      }
    }));

    await broadcastStandings(id);
    res.json(team);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getLeaderboard(req, res) {
  try {
    const { id } = req.params;
    if (isMemoryStore()) {
      const tournament = memoryStore.getTournament(id);
      if (!tournament) return res.status(404).json({ error: 'Not found' });
      const standings = aggregateStandings(memoryStore.getMatches(id), memoryStore.getTeams(id));
      return res.json({ tournament, standings });
    }
    const tournament = await Tournament.findById(id);
    const teams = await Team.find({ tournamentId: id });
    const matches = await Match.find({ tournamentId: id });
    res.json({ tournament, standings: aggregateStandings(matches, teams) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function submitMatchResults(req, res) {
  try {
    const { id } = req.params;
    const { matchNumber, results, inputMode, ocrProcessed, screenshots } = req.body;
    const mode = inputMode || 'cr_biasa';

    if (isMemoryStore()) {
      const tournament = memoryStore.getTournament(id);
      if (!tournament) return res.status(404).json({ error: 'Not found' });
      const match = memoryStore.findMatch(id, matchNumber);
      if (!match) return res.status(404).json({ error: 'Match not found' });

      const scored = calcMatchPoints(results, tournament.scoringRules, mode);
      const updated = memoryStore.updateMatch(match._id, {
        results: scored,
        status: 'verified',
        inputMode: mode,
        ocrProcessed: !!ocrProcessed,
        verifiedAt: new Date().toISOString(),
        screenshots: Array.isArray(screenshots) ? screenshots.slice(0, 3) : (match.screenshots || []),
      });
      if (ocrProcessed) memoryStore.incrementOcrScans(1);
      await broadcastStandings(id);
      return res.json(updated);
    }

    const tournament = await Tournament.findById(id);
    const scored = calcMatchPoints(results, {
      placementPoints: Object.fromEntries(tournament.scoringRules?.placementPoints || []),
      killPoint: tournament.scoringRules?.killPoint,
      booyahBonus: tournament.scoringRules?.booyahBonus,
    }, mode);

    const patch = {
      results: scored,
      status: 'verified',
      inputMode: mode,
      ocrProcessed: !!ocrProcessed,
      verifiedAt: new Date(),
    };
    if (Array.isArray(screenshots)) {
      patch.screenshots = screenshots.slice(0, 3);
    }

    const match = await Match.findOneAndUpdate(
      { tournamentId: id, matchNumber },
      patch,
      { new: true }
    );
    if (!match) return res.status(404).json({ error: 'Match not found' });
    await broadcastStandings(id);
    res.json(match);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function deleteTournament(req, res) {
  try {
    const { id } = req.params;
    if (isMemoryStore()) {
      if (!memoryStore.deleteTournament(id)) return res.status(404).json({ error: 'Not found' });
      return res.json({ message: 'Deleted' });
    }
    await Match.deleteMany({ tournamentId: id });
    await Team.deleteMany({ tournamentId: id });
    await Tournament.findByIdAndDelete(id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function recordOcrScan(req, res) {
  const count = req.body.count || 1;
  if (isMemoryStore()) memoryStore.incrementOcrScans(count);
  res.json({ ok: true });
}
