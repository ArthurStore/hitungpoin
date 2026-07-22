import { runServerOcr } from '../services/ocrService.js';
import { isMemoryStore } from '../config/database.js';
import { memoryStore } from '../config/memoryStore.js';

export async function scanImage(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
    const result = await runServerOcr(req.file.buffer);
    if (!result.success) return res.status(422).json(result);
    if (isMemoryStore()) memoryStore.incrementOcrScans(1);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
