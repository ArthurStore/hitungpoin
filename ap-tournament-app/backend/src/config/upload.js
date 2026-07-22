import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_DIR = path.join(__dirname, '../../uploads');
export const LOGOS_DIR = path.join(UPLOADS_DIR, 'logos');
export const MEDIA_DIR = path.join(UPLOADS_DIR, 'media');

[UPLOADS_DIR, LOGOS_DIR, MEDIA_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, LOGOS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `${uuidv4()}${ext}`);
  },
});

export const logoUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  },
});

export const ocrUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  },
});

export function getPublicUrl(filename, type = 'logos') {
  return `/uploads/${type}/${filename}`;
}

export function clearMediaStorage() {
  let count = 0;
  [LOGOS_DIR, MEDIA_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach((f) => {
      fs.unlinkSync(path.join(dir, f));
      count += 1;
    });
  });
  return count;
}
