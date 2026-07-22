import { Router } from 'express';
import { logoUpload } from '../config/upload.js';
import { uploadLogo } from '../controllers/uploadController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.post('/logo', authMiddleware, logoUpload.single('logo'), uploadLogo);
export default router;
