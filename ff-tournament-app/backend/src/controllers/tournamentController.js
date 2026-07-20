import { isMemoryStore } from '../config/database.js';
import { memoryStore } from '../config/memoryStore.js';
import Tournament from '../models/Tournament.js';
import Team from '../models/Team.js';
import Match from '../models/Match.js';
import {
  calcMatchPoints,
  aggregateStandings,
  checkChampionsRushWinner,
  parseRosterInput,
} from '../utils/pointsCalc.js';

const MAPS = ['Bermuda', 'Purgatory', 'Kalahari', 'Nexterra', 'Alpine', 'Solara'];

export async function getAllTournaments(req, res) {
  try {
    if (isMemoryStore()) {
      return res.json(memoryStore.getTournaments());
    }
    const tournaments = await Tournament.find().populate('teams').sort({ createdAt: -1 });
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
      const teams = memoryStore.getTeams(id);
      const matches = memoryStore.getMatches(id);
      return res.json({ ...t, teams, matches });
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
    const { name, logo, format, targetPoints, totalMatches, matchConfigs, rosterText, teams: teamsInput } = req.body;

    const parsedTeams = rosterText ? parseRosterInput(rosterText) : teamsInput || [];
    const configs = matchConfigs || Array.from({ length: totalMatches || 6 }, (_, i) => ({
      matchNumber: i + 1,
      map: MAPS[i % MAPS.length],
    }));

    if (isMemoryStore()) {
      const tournament = memoryStore.createTournament({
        name,
        logo,
        format: format || 'One Day',
        targetPoints: targetPoints || 80,
        totalMatches: totalMatches || configs.length,
        matchConfigs: configs,
        status: 'active',
        startDate: new Date().toISOString(),
      });

      const teams = memoryStore.createTeams(
        parsedTeams.map((t) => ({ ...t, tournamentId: tournament._id }))
      );
      tournament.teams = teams.map((t) => t._id);

      configs.forEach((cfg) => {
        memoryStore.createMatch({
          tournamentId: tournament._id,
          matchNumber: cfg.matchNumber,
          map: cfg.map,
        });
      });

      return res.status(201).json({ ...tournament, teams });
    }

    const tournament = await Tournament.create({
      name,
      logo,
      format: format || 'One Day',
      targetPoints: targetPoints || 80,
      totalMatches: totalMatches || configs.length,
      matchConfigs: configs,
      status: 'active',
      startDate: new Date(),
    });

    const teams = await Team.insertMany(
      parsedTeams.map((t) => ({ ...t, tournamentId: tournament._id }))
    );
    tournament.teams = teams.map((t) => t._id);
    await tournament.save();

    await Match.insertMany(
      configs.map((cfg) => ({
        tournamentId: tournament._id,
        matchNumber: cfg.matchNumber,
        map: cfg.map,
      }))
    );

    res.status(201).json({ ...tournament.toObject(), teams });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateTournament(req, res) {
  try {
    const { id } = req.params;
    if (isMemoryStore()) {
      const updated = memoryStore.updateTournament(id, req.body);
      if (!updated) return res.status(404).json({ error: 'Tournament not found' });
      return res.json(updated);
    }
    const tournament = await Tournament.findByIdAndUpdate(id, req.body, { new: true });
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    res.json(tournament);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function deleteTournament(req, res) {
  try {
    const { id } = req.params;
    if (isMemoryStore()) {
      const ok = memoryStore.deleteTournament(id);
      if (!ok) return res.status(404).json({ error: 'Tournament not found' });
      return res.json({ message: 'Tournament deleted' });
    }
    await Match.deleteMany({ tournamentId: id });
    await Team.deleteMany({ tournamentId: id });
    await Tournament.findByIdAndDelete(id);
    res.json({ message: 'Tournament deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getLeaderboard(req, res) {
  try {
    const { id } = req.params;
    if (isMemoryStore()) {
      const tournament = memoryStore.getTournament(id);
      if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
      const teams = memoryStore.getTeams(id);
      const matches = memoryStore.getMatches(id);
      const standings = aggregateStandings(matches, teams);
      let winner = null;
      if (tournament.format === 'Champions Rush') {
        winner = checkChampionsRushWinner(standings, tournament.targetPoints);
      }
      return res.json({ tournament, standings, winner });
    }

    const tournament = await Tournament.findById(id);
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    const teams = await Team.find({ tournamentId: id });
    const matches = await Match.find({ tournamentId: id });
    const standings = aggregateStandings(matches, teams);
    let winner = null;
    if (tournament.format === 'Champions Rush') {
      winner = checkChampionsRushWinner(standings, tournament.targetPoints);
    }
    res.json({ tournament, standings, winner });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function submitMatchResults(req, res) {
  try {
    const { id } = req.params;
    const { matchNumber, results, ocrProcessed } = req.body;

    if (isMemoryStore()) {
      const tournament = memoryStore.getTournament(id);
      if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
      const matches = memoryStore.getMatches(id);
      const match = matches.find((m) => m.matchNumber === matchNumber);
      if (!match) return res.status(404).json({ error: 'Match not found' });

      const scored = calcMatchPoints(results, tournament.scoringRules);
      const updated = memoryStore.updateMatch(match._id, {
        results: scored,
        status: 'verified',
        ocrProcessed: ocrProcessed || false,
        verifiedAt: new Date().toISOString(),
      });
      if (ocrProcessed) memoryStore.incrementOcrScans(1);
      return res.json(updated);
    }

    const tournament = await Tournament.findById(id);
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

    const scored = calcMatchPoints(results, {
      placementPoints: Object.fromEntries(tournament.scoringRules?.placementPoints || []),
      killPoint: tournament.scoringRules?.killPoint,
      booyahBonus: tournament.scoringRules?.booyahBonus,
    });

    const match = await Match.findOneAndUpdate(
      { tournamentId: id, matchNumber },
      {
        results: scored,
        status: 'verified',
        ocrProcessed: ocrProcessed || false,
        verifiedAt: new Date(),
      },
      { new: true }
    );
    if (!match) return res.status(404).json({ error: 'Match not found' });
    res.json(match);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
