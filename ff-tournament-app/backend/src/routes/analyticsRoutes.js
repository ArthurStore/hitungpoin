import { Router } from 'express';
import { getDashboardMetrics, recordOcrScan, getMatches } from '../controllers/analyticsController.js';

const router = Router();

router.get('/dashboard', getDashboardMetrics);
router.post('/ocr-scan', recordOcrScan);
router.get('/matches', getMatches);

export default router;
