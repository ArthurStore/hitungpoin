import { Router } from 'express';
import {
  getAllTournaments,
  getTournament,
  createTournament,
  updateTournament,
  deleteTournament,
  getLeaderboard,
  submitMatchResults,
} from '../controllers/tournamentController.js';

const router = Router();

router.get('/', getAllTournaments);
router.get('/:id', getTournament);
router.post('/', createTournament);
router.put('/:id', updateTournament);
router.delete('/:id', deleteTournament);
router.get('/:id/leaderboard', getLeaderboard);
router.post('/:id/matches/results', submitMatchResults);

export default router;
