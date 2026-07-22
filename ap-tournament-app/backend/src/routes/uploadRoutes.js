import { Router } from 'express';
import { logoUpload, certUpload } from '../config/upload.js';
import { uploadLogo, uploadCertificateTemplate } from '../controllers/uploadController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

function multerError(err, _req, res, next) {
  if (!err) return next();
  if (err instanceof Error && err.message?.includes('Only image')) {
    return res.status(400).json({ error: err.message });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large (max 15MB)' });
  }
  return res.status(400).json({ error: err.message || 'Upload error' });
}

router.post('/logo', authMiddleware, (req, res, next) => {
  logoUpload.single('logo')(req, res, (err) => {
    if (err) return multerError(err, req, res, next);
    return uploadLogo(req, res);
  });
});

router.post('/certificate', authMiddleware, (req, res, next) => {
  certUpload.single('template')(req, res, (err) => {
    if (err) return multerError(err, req, res, next);
    return uploadCertificateTemplate(req, res);
  });
});

export default router;
