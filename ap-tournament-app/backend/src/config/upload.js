import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_DIR = path.join(__dirname, '../../uploads');
export const LOGOS_DIR = path.join(UPLOADS_DIR, 'logos');
export const MEDIA_DIR = path.join(UPLOADS_DIR, 'media');
export const CERTS_DIR = path.join(UPLOADS_DIR, 'certificates');

[UPLOADS_DIR, LOGOS_DIR, MEDIA_DIR, CERTS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function makeDiskStorage(dest) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname)?.toLowerCase() || '.png';
      const safe = ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext) ? ext : '.png';
      cb(null, `${uuidv4()}${safe}`);
    },
  });
}

function imageFilter(_req, file, cb) {
  if (file.mimetype?.startsWith('image/')) cb(null, true);
  else cb(new Error('Only image files allowed'));
}

export const logoUpload = multer({
  storage: makeDiskStorage(LOGOS_DIR),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: imageFilter,
});

export const certUpload = multer({
  storage: makeDiskStorage(CERTS_DIR),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: imageFilter,
});

export const ocrUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: imageFilter,
});

export function getPublicUrl(filename, type = 'logos') {
  return `/uploads/${type}/${filename}`;
}

export function clearMediaStorage() {
  let count = 0;
  [LOGOS_DIR, MEDIA_DIR, CERTS_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach((f) => {
      try {
        fs.unlinkSync(path.join(dir, f));
        count += 1;
      } catch { /* skip locked */ }
    });
  });
  return count;
}
