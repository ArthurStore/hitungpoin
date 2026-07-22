import { isMemoryStore } from '../config/database.js';
import { memoryStore } from '../config/memoryStore.js';
import Tournament from '../models/Tournament.js';
import Team from '../models/Team.js';
import Match from '../models/Match.js';
import { calcMatchPoints, aggregateStandings, parseRosterInput, MAPS } from '../utils/pointsCalc.js';

function buildMatchConfigs(totalMatches, matchConfigs) {
  if (matchConfigs?.length) return matchConfigs;
  return Array.from({ length: totalMatches || 6 }, (_, i) => ({
    matchNumber: i + 1,
    map: MAPS[i % MAPS.length],
  }));
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
    const { matchNumber, results, inputMode, ocrProcessed } = req.body;
    const mode = inputMode || 'cr_biasa';

    if (isMemoryStore()) {
      const tournament = memoryStore.getTournament(id);
      if (!tournament) return res.status(404).json({ error: 'Not found' });
      const match = memoryStore.findMatch(id, matchNumber);
      if (!match) return res.status(404).json({ error: 'Match not found' });

      const scored = calcMatchPoints(results, tournament.scoringRules, mode);
      const updated = memoryStore.updateMatch(match._id, {
        results: scored, status: 'verified', inputMode: mode,
        ocrProcessed: !!ocrProcessed, verifiedAt: new Date().toISOString(),
      });
      if (ocrProcessed) memoryStore.incrementOcrScans(1);
      return res.json(updated);
    }

    const tournament = await Tournament.findById(id);
    const scored = calcMatchPoints(results, {
      placementPoints: Object.fromEntries(tournament.scoringRules?.placementPoints || []),
      killPoint: tournament.scoringRules?.killPoint,
      booyahBonus: tournament.scoringRules?.booyahBonus,
    }, mode);

    const match = await Match.findOneAndUpdate(
      { tournamentId: id, matchNumber },
      { results: scored, status: 'verified', inputMode: mode, ocrProcessed: !!ocrProcessed, verifiedAt: new Date() },
      { new: true }
    );
    if (!match) return res.status(404).json({ error: 'Match not found' });
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
