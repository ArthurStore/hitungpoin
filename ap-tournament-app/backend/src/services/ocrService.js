import Tesseract from 'tesseract.js';
import sharp from 'sharp';

const OCR_TIMEOUT_MS = 55000;
let workerPromise = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = Tesseract.createWorker('eng', 1, { logger: () => {} });
  }
  return workerPromise;
}

export async function preprocessImage(buffer) {
  return sharp(buffer)
    .resize({ width: 1920, withoutEnlargement: true })
    .grayscale()
    .normalize()
    .linear(1.2, -(128 * 0.2))
    .threshold(140)
    .png()
    .toBuffer();
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`OCR timeout after ${ms / 1000}s`)), ms)),
  ]);
}

export async function runServerOcr(imageBuffer) {
  try {
    const processed = await preprocessImage(imageBuffer);
    const worker = await getWorker();
    await worker.setParameters({ tessedit_pageseg_mode: '6' });

    const result = await withTimeout(worker.recognize(processed), OCR_TIMEOUT_MS);
    return { success: true, text: result.data.text, engine: 'server-tesseract' };
  } catch (err) {
    return { success: false, error: err.message, text: '', engine: 'server-tesseract' };
  }
}

export async function shutdownOcrWorker() {
  if (workerPromise) {
    const w = await workerPromise;
    await w.terminate();
    workerPromise = null;
  }
}
