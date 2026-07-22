import { useState, useCallback, useRef } from 'react';
import { UploadSimple, Image as ImageIcon, CircleNotch } from '@phosphor-icons/react';
import { api, resolveAssetUrl } from '../utils/api';

const UPLOAD_TIMEOUT_MS = 25000;

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function LogoDropzone({ value, onChange, disabled, label = 'logo' }) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const handleFile = useCallback(async (file) => {
    if (!file?.type?.startsWith('image/')) {
      setError('File harus berupa gambar');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError('Maksimal 15MB');
      return;
    }

    setError('');
    setUploading(true);

    // Instant local preview so UI never feels stuck
    let localPreview = '';
    try {
      localPreview = await readAsDataUrl(file);
      onChange(localPreview);
    } catch { /* ignore */ }

    try {
      const result = await Promise.race([
        api.uploadLogo(file),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Upload timeout — menggunakan preview lokal')), UPLOAD_TIMEOUT_MS)
        ),
      ]);
      if (result?.url) {
        onChange(result.url);
        setError('');
      }
    } catch (err) {
      setError(err.message || 'Upload gagal');
      if (localPreview) onChange(localPreview);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }, [onChange]);

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled || uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const previewUrl = resolveAssetUrl(value);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={`relative flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition ${
        dragOver ? 'border-emerald/50 bg-emerald/5' : 'border-white/10 bg-slate-800/30 hover:border-white/20'
      } ${disabled ? 'pointer-events-none opacity-50' : ''}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        disabled={disabled || uploading}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
        className="absolute inset-0 z-10 cursor-pointer opacity-0"
      />
      {uploading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-xl bg-slate-900/70">
          <CircleNotch size={32} className="animate-spin text-emerald" />
          <p className="mt-2 text-sm text-emerald">Uploading {label}...</p>
        </div>
      )}
      {previewUrl ? (
        <>
          <img src={previewUrl} alt="Preview" className="max-h-24 max-w-full rounded-lg object-contain" crossOrigin="anonymous" />
          <span className="mt-2 flex items-center gap-1 text-xs text-emerald">
            <ImageIcon size={14} /> Click or drop to replace
          </span>
        </>
      ) : (
        <>
          <UploadSimple size={32} className="text-slate-500" weight="duotone" />
          <p className="mt-2 text-sm font-medium text-white">Drag & drop {label} here</p>
          <p className="mt-1 text-xs text-slate-500">PNG, JPG (max 15MB)</p>
        </>
      )}
      {error && <p className="mt-2 max-w-xs text-center text-xs text-amber-400">{error}</p>}
    </div>
  );
}
