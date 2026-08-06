import { useEffect, useState, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Certificate, Download, UploadSimple, Trash } from '@phosphor-icons/react';
import Button from '../../components/Button';
import Toast from '../../components/Toast';
import { api, resolveAssetUrl } from '../../utils/api';
import { downloadDataUrl } from '../../utils/exportUtils';

const ALL_PLACEHOLDERS = {
  rank: { x: 50, y: 32, label: 'Peringkat / Rank', enabled: true },
  teamName: { x: 50, y: 44, label: 'Nama Tim / Peserta', enabled: true },
  finalScore: { x: 50, y: 54, label: 'Score Poin Akhir', enabled: true },
  tournamentName: { x: 50, y: 64, label: 'Nama Turnamen', enabled: true },
  date: { x: 50, y: 74, label: 'Tanggal', enabled: true },
};

const RANK_LABELS = { 1: 'JUARA 1', 2: 'JUARA 2', 3: 'JUARA 3' };

const DISPLAY_FONTS = [
  { id: 'Orbitron', label: 'Orbitron (eSports)' },
  { id: 'Russo One', label: 'Russo One (Header)' },
  { id: 'Rajdhani', label: 'Rajdhani (Display)' },
];

const BODY_FONTS = [
  { id: 'Montserrat', label: 'Montserrat' },
  { id: 'Poppins', label: 'Poppins' },
  { id: 'Cinzel', label: 'Cinzel (Elegant)' },
];

const COLOR_PRESETS = {
  'Gold Premium': {
    rank: '#F59E0B', team: '#FFF7ED', score: '#FDE68A', tournament: '#FCD34D', date: '#A8A29E',
  },
  'Cyberpunk Neon': {
    rank: '#22D3EE', team: '#E879F9', score: '#A3E635', tournament: '#67E8F9', date: '#94A3B8',
  },
  'Minimalist Dark': {
    rank: '#F8FAFC', team: '#F1F5F9', score: '#E2E8F0', tournament: '#CBD5E1', date: '#64748B',
  },
  'Minimalist Light': {
    rank: '#0F172A', team: '#1E293B', score: '#334155', tournament: '#475569', date: '#64748B',
  },
};

const DEFAULT_STYLE = {
  displayFont: 'Orbitron',
  bodyFont: 'Montserrat',
  colors: { ...COLOR_PRESETS['Gold Premium'] },
  rankWeight: '800',
  teamWeight: '700',
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function ensureFonts(fonts) {
  if (!document.fonts?.load) return;
  await Promise.all(fonts.map((f) => document.fonts.load(`700 48px "${f}"`).catch(() => null)));
}

function mergePlaceholders(saved = {}) {
  const merged = {};
  Object.keys(ALL_PLACEHOLDERS).forEach((key) => {
    const base = ALL_PLACEHOLDERS[key];
    const s = saved[key] || {};
    merged[key] = {
      ...base,
      x: s.x ?? base.x,
      y: s.y ?? base.y,
      enabled: s.enabled !== undefined ? !!s.enabled : (s.removed ? false : base.enabled),
      label: base.label,
    };
  });
  return merged;
}

async function renderCertificate({
  templateUrl, placeholders, style, teamName, rank, tournamentName, date, finalScore,
}) {
  await ensureFonts([style.displayFont, style.bodyFont]);
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
    ctx.strokeStyle = style.colors.rank;
    ctx.lineWidth = 6;
    ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);
  }

  const drawText = (text, pos, size, color, fontFamily, weight = '700') => {
    if (!pos?.enabled) return;
    const x = (pos.x / 100) * canvas.width;
    const y = (pos.y / 100) * canvas.height;
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px "${fontFamily}", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 8;
    ctx.fillText(String(text), x, y);
    ctx.shadowBlur = 0;
  };

  const c = style.colors;
  drawText(RANK_LABELS[rank] || `JUARA ${rank}`, placeholders.rank, Math.round(canvas.width * 0.038), c.rank, style.displayFont, style.rankWeight);
  drawText(teamName, placeholders.teamName, Math.round(canvas.width * 0.048), c.team, style.bodyFont, style.teamWeight);
  drawText(`${finalScore ?? 0} PTS`, placeholders.finalScore, Math.round(canvas.width * 0.032), c.score || c.rank, style.displayFont, '700');
  drawText(tournamentName, placeholders.tournamentName, Math.round(canvas.width * 0.024), c.tournament, style.bodyFont, '600');
  drawText(date, placeholders.date, Math.round(canvas.width * 0.02), c.date, style.bodyFont, '500');

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
  const [placeholders, setPlaceholders] = useState(mergePlaceholders(tournament?.certificatePlaceholders));
  const [style, setStyle] = useState({
    ...DEFAULT_STYLE,
    ...(tournament?.certificateStyle || {}),
    colors: { ...DEFAULT_STYLE.colors, ...(tournament?.certificateStyle?.colors || {}) },
  });
  const [dragging, setDragging] = useState(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    api.getLeaderboard(tournament._id).then((d) => setStandings(d.standings || []));
  }, [tournament._id]);

  useEffect(() => {
    setTemplateUrl(tournament?.certificateTemplate || '');
    setPlaceholders(mergePlaceholders(tournament?.certificatePlaceholders));
    setStyle({
      ...DEFAULT_STYLE,
      ...(tournament?.certificateStyle || {}),
      colors: { ...DEFAULT_STYLE.colors, ...(tournament?.certificateStyle?.colors || {}) },
    });
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
    if (!placeholders[key]?.enabled) return;
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

  const removePlaceholder = (key) => {
    setPlaceholders((prev) => ({
      ...prev,
      [key]: { ...prev[key], enabled: false },
    }));
  };

  const restorePlaceholder = (key) => {
    setPlaceholders((prev) => ({
      ...prev,
      [key]: { ...prev[key], enabled: true },
    }));
  };

  const applyPreset = (name) => {
    setStyle((s) => ({ ...s, colors: { ...COLOR_PRESETS[name] } }));
  };

  const saveLayout = async () => {
    setSaving(true);
    try {
      const phPayload = {};
      Object.entries(placeholders).forEach(([key, pos]) => {
        phPayload[key] = { x: pos.x, y: pos.y, enabled: !!pos.enabled };
      });
      await api.updateTournament(tournament._id, {
        certificateTemplate: templateUrl?.startsWith('data:') ? tournament.certificateTemplate : templateUrl,
        certificatePlaceholders: phPayload,
        certificateStyle: style,
      });
      await refresh?.();
      setToast({ message: 'Template, warna & placeholder disimpan!', type: 'success' });
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
          style,
          teamName: top[i].teamName,
          rank: i + 1,
          tournamentName: tournament.name,
          date,
          finalScore: top[i].totalPoints ?? 0,
        });
        certs.push({ rank: i + 1, teamName: top[i].teamName, dataUrl, finalScore: top[i].totalPoints });
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
  const colorField = (key, label) => (
    <label key={key} className="block text-xs text-slate-400">
      {label}
      <input
        type="color"
        value={style.colors[key] || '#ffffff'}
        onChange={(e) => setStyle((s) => ({ ...s, colors: { ...s.colors, [key]: e.target.value } }))}
        className="mt-1 h-10 w-full cursor-pointer rounded-lg border border-white/10 bg-slate-900"
      />
    </label>
  );

  return (
    <div className="space-y-6">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-white light:text-slate-900">Certificate Template Builder</h2>
          <p className="text-xs text-slate-500">Color picker per elemen · hapus placeholder · Score Poin Akhir</p>
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
            {Object.entries(placeholders).filter(([, pos]) => pos.enabled).map(([key, pos]) => (
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
        </div>

        <div className="space-y-4">
          <div className="glass-panel space-y-4 rounded-2xl p-4">
            <p className="font-semibold text-white">Typography</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-slate-400">
                Display / Header
                <select
                  value={style.displayFont}
                  onChange={(e) => setStyle((s) => ({ ...s, displayFont: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
                >
                  {DISPLAY_FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </label>
              <label className="text-xs text-slate-400">
                Body / Nama Tim
                <select
                  value={style.bodyFont}
                  onChange={(e) => setStyle((s) => ({ ...s, bodyFont: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white"
                >
                  {BODY_FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </label>
            </div>

            <p className="pt-2 font-semibold text-white">Color Picker (per elemen)</p>
            <div className="flex flex-wrap gap-2">
              {Object.keys(COLOR_PRESETS).map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => applyPreset(name)}
                  className="rounded-full border border-white/10 bg-slate-800 px-3 py-1 text-[11px] font-semibold text-slate-200 hover:border-gold/40 hover:text-gold"
                >
                  {name}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {colorField('rank', 'Peringkat / Rank')}
              {colorField('team', 'Nama Tim')}
              {colorField('score', 'Score Poin Akhir')}
              {colorField('tournament', 'Turnamen')}
              {colorField('date', 'Tanggal')}
            </div>

            <p className="pt-2 font-semibold text-white">Placeholders</p>
            <ul className="space-y-2">
              {Object.entries(placeholders).map(([key, pos]) => (
                <li key={key} className="flex items-center justify-between gap-2 rounded-lg bg-slate-800/50 px-3 py-2 text-xs">
                  <span className={pos.enabled ? 'text-white' : 'text-slate-500 line-through'}>{pos.label}</span>
                  {pos.enabled ? (
                    <button
                      type="button"
                      onClick={() => removePlaceholder(key)}
                      className="inline-flex items-center gap-1 rounded-lg bg-crimson/15 px-2 py-1 text-crimson hover:bg-crimson/25"
                    >
                      <Trash size={12} /> Remove
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => restorePlaceholder(key)}
                      className="rounded-lg bg-emerald/15 px-2 py-1 text-emerald hover:bg-emerald/25"
                    >
                      Restore
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {certificates.length > 0 && (
            <div className="grid gap-4">
              {certificates.map((cert) => (
                <div key={cert.rank} className="glass-panel overflow-hidden rounded-2xl">
                  <div className="border-b border-white/5 px-4 py-2">
                    <p className="text-sm font-bold text-gold">
                      Juara {cert.rank} — {cert.teamName}
                      {cert.finalScore != null && <span className="ml-2 text-emerald">{cert.finalScore} PTS</span>}
                    </p>
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
