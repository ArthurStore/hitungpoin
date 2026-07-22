import { getPublicUrl } from '../config/upload.js';

export function uploadLogo(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const url = getPublicUrl(req.file.filename, 'logos');
    res.json({ url, filename: req.file.filename, path: url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
