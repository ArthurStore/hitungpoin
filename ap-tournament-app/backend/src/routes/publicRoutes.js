import { Router } from 'express';
import { getPublicStandings } from '../controllers/publicController.js';

const router = Router();
router.get('/:id/standings', getPublicStandings);
export default router;
