import { runGeminiVisionOcr } from '../services/geminiOcr.js';
import { bumpManualScan } from '../config/settingsStore.js';

export async function scanImage(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    const mime = req.file.mimetype || 'image/png';
    const result = await runGeminiVisionOcr(req.file.buffer, mime);

    if (!result.success) {
      return res.status(422).json(result);
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message, success: false });
  }
}

export function recordManualScan(_req, res) {
  bumpManualScan();
  res.json({ ok: true });
}
