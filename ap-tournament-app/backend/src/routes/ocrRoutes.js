import { Router } from 'express';
import { ocrUpload } from '../config/upload.js';
import { scanImage } from '../controllers/ocrController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.post('/scan', authMiddleware, ocrUpload.single('image'), scanImage);
export default router;
