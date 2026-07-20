/**
 * Crop regions for Free Fire 16:9 widescreen scoreboard screenshots.
 * Coordinates are relative (0-1) to image dimensions.
 */
export const SCOREBOARD_REGIONS = {
  fullScoreboard: { x: 0.05, y: 0.15, w: 0.9, h: 0.7 },
  leftPanel: { x: 0.05, y: 0.2, w: 0.45, h: 0.65 },
  rightPanel: { x: 0.5, y: 0.2, w: 0.45, h: 0.65 },
  rankColumn: { x: 0.06, y: 0.25, w: 0.08, h: 0.6 },
  teamColumn: { x: 0.15, y: 0.25, w: 0.35, h: 0.6 },
  killColumn: { x: 0.52, y: 0.25, w: 0.1, h: 0.6 },
};

export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function cropImage(img, region, scale = 1) {
  const canvas = document.createElement('canvas');
  const sx = Math.floor(img.width * region.x);
  const sy = Math.floor(img.height * region.y);
  const sw = Math.floor(img.width * region.w);
  const sh = Math.floor(img.height * region.h);

  canvas.width = sw * scale;
  canvas.height = sh * scale;

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  return canvas;
}

export function preprocessForOCR(canvas) {
  const processed = document.createElement('canvas');
  processed.width = canvas.width;
  processed.height = canvas.height;
  const ctx = processed.getContext('2d');

  ctx.drawImage(canvas, 0, 0);
  const imageData = ctx.getImageData(0, 0, processed.width, processed.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    const enhanced = gray > 128 ? 255 : gray < 64 ? 0 : gray * 1.2;
    data[i] = enhanced;
    data[i + 1] = enhanced;
    data[i + 2] = enhanced;
  }

  ctx.putImageData(imageData, 0, 0);
  return processed;
}

export function canvasToDataUrl(canvas) {
  return canvas.toDataURL('image/png');
}

export async function cropScoreboard(file, regionKey = 'fullScoreboard') {
  const img = await loadImage(file);
  const region = SCOREBOARD_REGIONS[regionKey] || SCOREBOARD_REGIONS.fullScoreboard;
  const cropped = cropImage(img, region, 2);
  const processed = preprocessForOCR(cropped);
  URL.revokeObjectURL(img.src);
  return { canvas: processed, dataUrl: canvasToDataUrl(processed) };
}
