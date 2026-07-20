import html2canvas from 'html2canvas';

export async function exportElementAsPNG(element, filename) {
  const canvas = await html2canvas(element, {
    backgroundColor: null,
    scale: 2,
    useCORS: true,
    logging: false,
  });
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

const CERT_COLORS = {
  1: { primary: '#F59E0B', label: 'JUARA 1' },
  2: { primary: '#94A3B8', label: 'JUARA 2' },
  3: { primary: '#CD7F32', label: 'JUARA 3' },
};

export async function generateCertificate({ rank = 1, teamName, tournamentName, date, totalPoints, logoUrl }) {
  const colors = CERT_COLORS[rank] || CERT_COLORS[1];
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 848;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grad.addColorStop(0, '#0F172A');
  grad.addColorStop(1, '#1E293B');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 4;
  ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);

  ctx.fillStyle = colors.primary;
  ctx.font = 'bold 28px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SERTIFIKAT PENGHARGAAN', canvas.width / 2, 120);
  ctx.font = 'bold 64px Outfit, sans-serif';
  ctx.fillText(colors.label, canvas.width / 2, 210);

  ctx.fillStyle = '#64748B';
  ctx.font = '20px Outfit, sans-serif';
  ctx.fillText(tournamentName, canvas.width / 2, 270);

  ctx.fillStyle = '#F1F5F9';
  ctx.font = 'bold 48px Outfit, sans-serif';
  ctx.fillText(teamName, canvas.width / 2, 380);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '22px Outfit, sans-serif';
  ctx.fillText('Total Score', canvas.width / 2, 440);

  ctx.fillStyle = colors.primary;
  ctx.font = 'bold 56px JetBrains Mono, monospace';
  ctx.fillText(String(totalPoints), canvas.width / 2, 510);

  ctx.fillStyle = '#64748B';
  ctx.font = '18px Outfit, sans-serif';
  ctx.fillText(date, canvas.width / 2, 560);
  ctx.font = '16px Outfit, sans-serif';
  ctx.fillText('AP (Arthur Points)', canvas.width / 2, 720);

  if (logoUrl) {
    try {
      const img = await loadImg(logoUrl);
      ctx.drawImage(img, canvas.width / 2 - 40, 600, 80, 80);
    } catch { /* skip */ }
  }

  return { dataUrl: canvas.toDataURL('image/png') };
}

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

export async function generateAllCertificates(tournament, standings) {
  const date = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const certs = [];
  for (let i = 0; i < Math.min(3, standings.length); i++) {
    const team = standings[i];
    const cert = await generateCertificate({
      rank: i + 1,
      teamName: team.teamName,
      tournamentName: tournament.name,
      date,
      totalPoints: team.totalPoints,
      logoUrl: tournament.logo,
    });
    certs.push({ rank: i + 1, teamName: team.teamName, ...cert });
  }
  return certs;
}
