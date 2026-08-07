import React, { useState } from 'react';
import { api, resolveAssetUrl, toRelativeUploadPath } from '../utils/api';

export default function LogoDropzone({ value, onChange, label = 'Event Logo' }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');

    try {
      const res = await api.uploadLogo(file);
      const uploadedPath = res.url || res.logoUrl || res.path;
      if (uploadedPath) {
        // Simpan path relatif bersih ke parent/DB (bukan URL absolut / sub-path)
        onChange(toRelativeUploadPath(uploadedPath));
      } else {
        setError('Gagal mendapatkan URL gambar dari server');
      }
    } catch (err) {
      console.error('Logo Upload Failed:', err);
      setError(err.message || 'Gagal mengupload logo');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const previewUrl = resolveAssetUrl(value);

  return (
    <div className="space-y-2">
      {label && <label className="block text-sm text-slate-300">{label}</label>}

      <div className="relative flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700 bg-slate-800/40 p-4 transition hover:border-emerald-500/50">
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="absolute inset-0 z-10 cursor-pointer opacity-0"
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            <span className="text-xs text-emerald-400">Mengupload logo...</span>
          </div>
        ) : previewUrl ? (
          <div className="flex flex-col items-center gap-2">
            <img
              src={previewUrl}
              alt="Logo Preview"
              className="max-h-24 max-w-full rounded-lg object-contain"
              onError={(e) => {
                console.error('Failed to load image at:', previewUrl);
                e.target.style.display = 'none';
              }}
            />
            <span className="text-xs text-slate-400">Klik atau drop gambar untuk mengganti</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <span className="text-sm font-medium">Klik atau drop logo di sini</span>
            <span className="text-xs text-slate-500">PNG, JPG, WEBP max 10MB</span>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
