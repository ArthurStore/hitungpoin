import { Router } from 'express';
import {
  listMyTournaments, getTournament, createTournament, updateTournament,
  updateTeams, upsertTeam, getLeaderboard, submitMatchResults, deleteTournament, recordOcrScan,
} from '../controllers/tournamentController.js';
import { authMiddleware, tournamentOwnerMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', listMyTournaments);
router.post('/', createTournament);
router.post('/ocr-scan', recordOcrScan);
router.get('/:id', tournamentOwnerMiddleware, getTournament);
router.put('/:id', tournamentOwnerMiddleware, updateTournament);
router.delete('/:id', tournamentOwnerMiddleware, deleteTournament);
router.put('/:id/teams', tournamentOwnerMiddleware, updateTeams);
router.post('/:id/teams/upsert', tournamentOwnerMiddleware, upsertTeam);
router.get('/:id/leaderboard', tournamentOwnerMiddleware, getLeaderboard);
router.post('/:id/matches/results', tournamentOwnerMiddleware, submitMatchResults);

export default router;
