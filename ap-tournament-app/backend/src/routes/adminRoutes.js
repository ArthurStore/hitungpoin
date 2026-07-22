import { Router } from 'express';
import {
  getAdminMetrics, verifyAdminPin, resetAllTournaments, resetMediaStorage,
  updateGeminiKey, testGemini, testGeminiImage,
} from '../controllers/adminController.js';
import { adminPinMiddleware } from '../middleware/auth.js';
import { ocrUpload } from '../config/upload.js';

const router = Router();

router.post('/verify-pin', adminPinMiddleware, verifyAdminPin);
router.get('/verify-pin', adminPinMiddleware, verifyAdminPin);
router.get('/metrics', adminPinMiddleware, getAdminMetrics);
router.post('/reset-tournaments', adminPinMiddleware, resetAllTournaments);
router.post('/reset-media', adminPinMiddleware, resetMediaStorage);
router.post('/gemini-key', adminPinMiddleware, updateGeminiKey);
router.post('/gemini-test', adminPinMiddleware, testGemini);
router.post('/gemini-test-image', adminPinMiddleware, (req, res, next) => {
  ocrUpload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ ok: false, error: err.message });
    return testGeminiImage(req, res);
  });
});

export default router;
