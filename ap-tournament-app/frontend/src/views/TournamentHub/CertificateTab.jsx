import { useEffect, useState, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Certificate, Download, UploadSimple } from '@phosphor-icons/react';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import { api, resolveAssetUrl } from '../../utils/api';
import { downloadDataUrl } from '../../utils/exportUtils';

const DEFAULT_PLACEHOLDERS = {
  teamName: { x: 50, y: 45, label: 'Nama Juara / Team' },
  rank: { x: 50, y: 35, label: 'Peringkat' },
  tournamentName: { x: 50, y: 58, label: 'Nama Turnamen' },
  date: { x: 50, y: 68, label: 'Tanggal' },
};

const RANK_LABELS = { 1: 'JUARA 1', 2: 'JUARA 2', 3: 'JUARA 3' };

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function renderCertificate({ templateUrl, placeholders, teamName, rank, tournamentName, date }) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (templateUrl) {
    const img = await loadImage(resolveAssetUrl(templateUrl));
    canvas.width = img.naturalWidth || 1600;
    canvas.height = img.naturalHeight || 1131;
    ctx.drawImage(img, 0, 0);
  } else {
    canvas.width = 1600;
    canvas.height = 1131;
    const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    g.addColorStop(0, '#0F172A');
    g.addColorStop(1, '#1E293B');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 6;
    ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);
  }

  const drawText = (text, pos, size, color = '#FFFFFF', weight = 'bold') => {
    if (!pos) return;
    const x = (pos.x / 100) * canvas.width;
    const y = (pos.y / 100) * canvas.height;
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px "Plus Jakarta Sans", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 8;
    ctx.fillText(String(text), x, y);
    ctx.shadowBlur = 0;
  };

  drawText(RANK_LABELS[rank] || `JUARA ${rank}`, placeholders.rank, Math.round(canvas.width * 0.035), '#F59E0B');
  drawText(teamName, placeholders.teamName, Math.round(canvas.width * 0.045), '#FFFFFF');
  drawText(tournamentName, placeholders.tournamentName, Math.round(canvas.width * 0.022), '#94A3B8', '600');
  drawText(date, placeholders.date, Math.round(canvas.width * 0.018), '#64748B', '500');

  return canvas.toDataURL('image/png');
}

export default function CertificateTab() {
  const { tournament, refresh } = useOutletContext();
  const [standings, setStandings] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'info' });
  const [templateUrl, setTemplateUrl] = useState(tournament?.certificateTemplate || '');
  const [placeholders, setPlaceholders] = useState({
    ...DEFAULT_PLACEHOLDERS,
    ...(tournament?.certificatePlaceholders || {}),
  });
  const [dragging, setDragging] = useState(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    api.getLeaderboard(tournament._id).then((d) => setStandings(d.standings || []));
  }, [tournament._id]);

  useEffect(() => {
    setTemplateUrl(tournament?.certificateTemplate || '');
    setPlaceholders({ ...DEFAULT_PLACEHOLDERS, ...(tournament?.certificatePlaceholders || {}) });
  }, [tournament]);

  const onTemplateFile = async (file) => {
    if (!file?.type?.startsWith('image/')) return;
    setUploading(true);
    try {
      const local = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      setTemplateUrl(local);
      try {
        const res = await api.uploadCertificateTemplate(file);
        if (res.url) setTemplateUrl(res.url);
      } catch (err) {
        setToast({ message: `${err.message} — preview lokal dipakai`, type: 'error' });
      }
    } finally {
      setUploading(false);
    }
  };

  const onPointerDown = (key) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(key);
  };

  const onPointerMove = useCallback((e) => {
    if (!dragging || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.min(95, Math.max(5, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(95, Math.max(5, ((e.clientY - rect.top) / rect.height) * 100));
    setPlaceholders((prev) => ({
      ...prev,
      [dragging]: { ...prev[dragging], x, y },
    }));
  }, [dragging]);

  useEffect(() => {
    if (!dragging) return undefined;
    const up = () => setDragging(null);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', up);
    };
  }, [dragging, onPointerMove]);

  const saveLayout = async () => {
    setSaving(true);
    try {
      await api.updateTournament(tournament._id, {
        certificateTemplate: templateUrl?.startsWith('data:') ? tournament.certificateTemplate : templateUrl,
        certificatePlaceholders: {
          teamName: { x: placeholders.teamName.x, y: placeholders.teamName.y },
          rank: { x: placeholders.rank.x, y: placeholders.rank.y },
          tournamentName: { x: placeholders.tournamentName.x, y: placeholders.tournamentName.y },
          date: { x: placeholders.date.x, y: placeholders.date.y },
        },
      });
      // If still data URL, try keep local for render but warn
      if (templateUrl?.startsWith('data:')) {
        setToast({ message: 'Layout disimpan. Upload template ke server gagal sebelumnya — render pakai preview lokal.', type: 'success' });
      } else {
        await refresh?.();
        setToast({ message: 'Template & posisi placeholder disimpan!', type: 'success' });
      }
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const date = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      const top = standings.slice(0, 3);
      const certs = [];
      for (let i = 0; i < top.length; i += 1) {
        const dataUrl = await renderCertificate({
          templateUrl,
          placeholders,
          teamName: top[i].teamName,
          rank: i + 1,
          tournamentName: tournament.name,
          date,
        });
        certs.push({ rank: i + 1, teamName: top[i].teamName, dataUrl });
      }
      setCertificates(certs);
      setToast({ message: `${certs.length} sertifikat digenerate`, type: 'success' });
    } catch (err) {
      setToast({ message: err.message || 'Gagal generate', type: 'error' });
    } finally {
      setGenerating(false);
    }
  };

  const previewSrc = resolveAssetUrl(templateUrl);

  return (
    <div className="space-y-6">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-white">Certificate Template Builder</h2>
          <p className="text-xs text-slate-500">Upload desain Canva/Photoshop, drag placeholder, export PNG</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={saveLayout} loading={saving}>Save Layout</Button>
          <Button variant="gold" onClick={handleGenerate} loading={generating} disabled={standings.length < 1}>
            <Certificate size={18} /> Generate Top 3
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass-panel rounded-2xl p-4">
          <label className="mb-2 block text-sm text-slate-300">Template Image</label>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/10 bg-slate-800/30 p-6 hover:border-emerald/40">
            <UploadSimple size={28} className="text-slate-500" />
            <p className="mt-2 text-sm text-white">{uploading ? 'Uploading...' : 'Upload PNG/JPG template'}</p>
            <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => onTemplateFile(e.target.files?.[0])} />
          </label>

          <div
            ref={canvasRef}
            className="relative mt-4 aspect-[16/11] overflow-hidden rounded-xl bg-slate-950 ring-1 ring-white/10"
          >
            {previewSrc ? (
              <img src={previewSrc} alt="Template" className="absolute inset-0 h-full w-full object-contain" draggable={false} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-600">Belum ada template</div>
            )}
            {Object.entries(placeholders).map(([key, pos]) => (
              <button
                key={key}
                type="button"
                onPointerDown={onPointerDown(key)}
                className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-lg border px-2 py-1 text-[10px] font-bold shadow-lg active:cursor-grabbing ${
                  dragging === key ? 'border-emerald bg-emerald text-white' : 'border-white/30 bg-black/70 text-white'
                }`}
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              >
                [{pos.label || key}]
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Drag badge placeholder ke posisi teks pada desain kamu.</p>
        </div>

        <div className="space-y-4">
          <div className="glass-panel rounded-2xl p-4 text-sm text-slate-400">
            <p className="font-semibold text-white">Placeholders</p>
            <ul className="mt-2 space-y-1 text-xs">
              <li>• [Nama Juara / Team Name]</li>
              <li>• [Peringkat / Rank #1–#3]</li>
              <li>• [Nama Turnamen]</li>
              <li>• [Tanggal]</li>
            </ul>
            {standings.length > 0 && (
              <p className="mt-3 text-xs">Top 3: {standings.slice(0, 3).map((s) => s.teamName).join(', ')}</p>
            )}
          </div>

          {certificates.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-1">
              {certificates.map((cert) => (
                <div key={cert.rank} className="glass-panel overflow-hidden rounded-2xl">
                  <div className="border-b border-white/5 px-4 py-2">
                    <p className="text-sm font-bold text-gold">Juara {cert.rank} — {cert.teamName}</p>
                  </div>
                  <img src={cert.dataUrl} alt={`Juara ${cert.rank}`} className="w-full p-2" />
                  <div className="p-3">
                    <Button variant="ghost" className="w-full"
                      onClick={() => downloadDataUrl(cert.dataUrl, `certificate-juara-${cert.rank}.png`)}>
                      <Download size={16} /> Download PNG
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
