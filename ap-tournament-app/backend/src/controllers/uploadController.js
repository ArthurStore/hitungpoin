import { getPublicUrl } from '../config/upload.js';

export function uploadLogo(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Field name must be "logo".' });
    }
    const url = getPublicUrl(req.file.filename, 'logos');
    return res.status(200).json({
      ok: true,
      url,
      path: url,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
}

export function uploadCertificateTemplate(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Field name must be "template".' });
    }
    const url = getPublicUrl(req.file.filename, 'certificates');
    return res.status(200).json({
      ok: true,
      url,
      path: url,
      filename: req.file.filename,
      size: req.file.size,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
}
