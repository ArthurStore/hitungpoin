import { isMemoryStore } from '../config/database.js';
import { memoryStore } from '../config/memoryStore.js';
import Tournament from '../models/Tournament.js';
import Team from '../models/Team.js';
import Match from '../models/Match.js';
import { aggregateStandings } from '../utils/pointsCalc.js';

export async function getPublicStandings(req, res) {
  try {
    const { id } = req.params;

    if (isMemoryStore()) {
      const tournament = memoryStore.getTournament(id);
      if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
      const standings = aggregateStandings(memoryStore.getMatches(id), memoryStore.getTeams(id));
      return res.json({
        tournament: {
          _id: tournament._id,
          name: tournament.name,
          logo: tournament.logo,
          format: tournament.format,
          status: tournament.status,
        },
        standings,
      });
    }

    const tournament = await Tournament.findById(id).select('name logo format status');
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    const teams = await Team.find({ tournamentId: id });
    const matches = await Match.find({ tournamentId: id, status: 'verified' });
    res.json({ tournament, standings: aggregateStandings(matches, teams) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
