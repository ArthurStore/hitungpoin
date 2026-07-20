import { Router } from 'express';
import { getAdminMetrics, verifyAdminPin } from '../controllers/adminController.js';
import { adminPinMiddleware } from '../middleware/auth.js';

const router = Router();
router.post('/verify-pin', adminPinMiddleware, verifyAdminPin);
router.get('/metrics', adminPinMiddleware, getAdminMetrics);
export default router;
