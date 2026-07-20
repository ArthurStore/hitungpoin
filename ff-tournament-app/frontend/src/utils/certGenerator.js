const CERT_COLORS = {
  1: { primary: '#F59E0B', secondary: '#D97706', label: 'JUARA 1' },
  2: { primary: '#94A3B8', secondary: '#64748B', label: 'JUARA 2' },
  3: { primary: '#CD7F32', secondary: '#A0522D', label: 'JUARA 3' },
};

export async function generateCertificate({
  rank = 1,
  teamName = 'Team Name',
  tournamentName = 'Tournament',
  date = new Date().toLocaleDateString('id-ID'),
  totalPoints = 0,
  logoUrl = null,
}) {
  const colors = CERT_COLORS[rank] || CERT_COLORS[1];
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 848;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#0F172A');
  gradient.addColorStop(0.5, '#1E293B');
  gradient.addColorStop(1, '#0F172A');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 4;
  ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);

  ctx.strokeStyle = colors.primary + '44';
  ctx.lineWidth = 1;
  ctx.strokeRect(55, 55, canvas.width - 110, canvas.height - 110);

  ctx.fillStyle = colors.primary;
  ctx.font = 'bold 28px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SERTIFIKAT PENGHARGAAN', canvas.width / 2, 120);

  ctx.fillStyle = colors.primary;
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
  ctx.fillText('Telah meraih prestasi gemilang dengan total poin', canvas.width / 2, 440);

  ctx.fillStyle = colors.primary;
  ctx.font = 'bold 56px "JetBrains Mono", monospace';
  ctx.fillText(String(totalPoints), canvas.width / 2, 510);

  ctx.fillStyle = '#64748B';
  ctx.font = '18px Outfit, sans-serif';
  ctx.fillText(`POIN  |  ${date}`, canvas.width / 2, 560);

  ctx.fillStyle = '#475569';
  ctx.font = '16px Outfit, sans-serif';
  ctx.fillText('GridPlay FF Edition', canvas.width / 2, 720);

  if (logoUrl) {
    try {
      const logo = await loadImage(logoUrl);
      const logoSize = 80;
      ctx.drawImage(logo, canvas.width / 2 - logoSize / 2, 600, logoSize, logoSize);
    } catch {
      /* skip logo on failure */
    }
  }

  return {
    canvas,
    dataUrl: canvas.toDataURL('image/png'),
    blob: await canvasToBlob(canvas),
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

export function downloadCertificate(dataUrl, filename) {
  const link = document.createElement('a');
  link.download = filename || 'sertifikat.png';
  link.href = dataUrl;
  link.click();
}

export async function generateAllCertificates(tournament, standings) {
  const top3 = standings.slice(0, 3);
  const certs = [];

  for (let i = 0; i < top3.length; i++) {
    const team = top3[i];
    const cert = await generateCertificate({
      rank: i + 1,
      teamName: team.teamName,
      tournamentName: tournament.name,
      date: new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      totalPoints: team.totalPoints,
      logoUrl: tournament.logo,
    });
    certs.push({ rank: i + 1, teamName: team.teamName, ...cert });
  }

  return certs;
}
