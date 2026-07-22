import { Router } from 'express';
import { ocrUpload } from '../config/upload.js';
import { scanImage, recordManualScan } from '../controllers/ocrController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.post('/scan', authMiddleware, (req, res, next) => {
  ocrUpload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, error: err.message });
    return scanImage(req, res);
  });
});

router.post('/manual-scan', authMiddleware, recordManualScan);

export default router;
