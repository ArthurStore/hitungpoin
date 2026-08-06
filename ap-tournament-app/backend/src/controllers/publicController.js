import { isMemoryStore } from '../config/database.js';
import { memoryStore } from '../config/memoryStore.js';
import Tournament from '../models/Tournament.js';
import Team from '../models/Team.js';
import Match from '../models/Match.js';
import { aggregateStandings } from '../utils/pointsCalc.js';

function slugify(name = '') {
  return String(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function resolveTournament(idOrSlug) {
  if (isMemoryStore()) {
    const byId = memoryStore.getTournament(idOrSlug);
    if (byId) return byId;
    const all = memoryStore.getTournaments?.() || [];
    return all.find((t) => slugify(t.name) === slugify(idOrSlug)) || null;
  }

  let tournament = await Tournament.findById(idOrSlug).catch(() => null);
  if (tournament) return tournament;

  const all = await Tournament.find({}).select('name logo format status totalMatches inputMode leaderboardSubtitle');
  return all.find((t) => slugify(t.name) === slugify(idOrSlug)) || null;
}

export async function getPublicStandings(req, res) {
  try {
    const { id } = req.params;
    const tournament = await resolveTournament(id);
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

    const tid = tournament._id;

    if (isMemoryStore()) {
      const standings = aggregateStandings(memoryStore.getMatches(tid), memoryStore.getTeams(tid));
      return res.json({
        tournament: {
          _id: tournament._id,
          name: tournament.name,
          logo: tournament.logo,
          format: tournament.format,
          status: tournament.status,
          totalMatches: tournament.totalMatches,
          inputMode: tournament.inputMode,
          leaderboardSubtitle: tournament.leaderboardSubtitle,
          slug: slugify(tournament.name),
        },
        standings,
        matches: memoryStore.getMatches(tid),
      });
    }

    const teams = await Team.find({ tournamentId: tid });
    const matches = await Match.find({ tournamentId: tid, status: 'verified' });
    res.json({
      tournament: {
        _id: tournament._id,
        name: tournament.name,
        logo: tournament.logo,
        format: tournament.format,
        status: tournament.status,
        totalMatches: tournament.totalMatches,
        inputMode: tournament.inputMode,
        leaderboardSubtitle: tournament.leaderboardSubtitle,
        slug: slugify(tournament.name),
      },
      standings: aggregateStandings(matches, teams),
      matches,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
