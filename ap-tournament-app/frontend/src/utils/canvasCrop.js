/** Crop regions for Free Fire scoreboard layouts (relative 0-1) */
export const CROP_REGIONS = {
  cr_biasa: {
    leftColumn: { x: 0.02, y: 0.12, w: 0.48, h: 0.78 },
    rightColumn: { x: 0.50, y: 0.12, w: 0.48, h: 0.78 },
    full: { x: 0.02, y: 0.10, w: 0.96, h: 0.82 },
  },
  cr_league: {
    leftTable: { x: 0.02, y: 0.18, w: 0.47, h: 0.72 },
    rightTable: { x: 0.51, y: 0.18, w: 0.47, h: 0.72 },
    full: { x: 0.02, y: 0.15, w: 0.96, h: 0.78 },
  },
};

export async function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function cropRegion(img, region, scale = 2) {
  const canvas = document.createElement('canvas');
  const sx = Math.floor(img.width * region.x);
  const sy = Math.floor(img.height * region.y);
  const sw = Math.floor(img.width * region.w);
  const sh = Math.floor(img.height * region.h);
  canvas.width = sw * scale;
  canvas.height = sh * scale;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function preprocess(canvas) {
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext('2d');
  ctx.drawImage(canvas, 0, 0);
  const imgData = ctx.getImageData(0, 0, out.width, out.height);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    const v = g > 140 ? 255 : g < 70 ? 0 : g * 1.15;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(imgData, 0, 0);
  return out;
}

export async function cropForMode(file, mode = 'cr_biasa') {
  const img = await loadImage(file);
  const regions = CROP_REGIONS[mode] || CROP_REGIONS.cr_biasa;

  const crops = [regions.full];
  if (mode === 'cr_biasa') {
    crops.push(regions.leftColumn, regions.rightColumn);
  } else {
    crops.push(regions.leftTable, regions.rightTable);
  }

  const processed = crops.map((r) => preprocess(cropRegion(img, r)));
  URL.revokeObjectURL(img.src);

  return {
    primary: processed[0].toDataURL('image/png'),
    extras: processed.slice(1).map((c) => c.toDataURL('image/png')),
  };
}
