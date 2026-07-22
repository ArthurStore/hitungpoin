import { Router } from 'express';
import {
  getAdminMetrics, verifyAdminPin, resetAllTournaments, resetMediaStorage,
} from '../controllers/adminController.js';
import { adminPinMiddleware } from '../middleware/auth.js';

const router = Router();
router.post('/verify-pin', adminPinMiddleware, verifyAdminPin);
router.get('/metrics', adminPinMiddleware, getAdminMetrics);
router.post('/reset-tournaments', adminPinMiddleware, resetAllTournaments);
router.post('/reset-media', adminPinMiddleware, resetMediaStorage);
export default router;
