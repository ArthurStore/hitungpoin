import { useState, useCallback } from 'react';
import { UploadSimple, Image as ImageIcon } from '@phosphor-icons/react';

export default function LogoDropzone({ value, onChange, disabled }) {
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback((file) => {
    if (!file?.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result);
    reader.readAsDataURL(file);
  }, [onChange]);

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

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
        type="file"
        accept="image/*"
        disabled={disabled}
        onChange={(e) => handleFile(e.target.files?.[0])}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
      {value ? (
        <img src={value} alt="Logo preview" className="max-h-24 max-w-full rounded-lg object-contain" />
      ) : (
        <>
          <UploadSimple size={32} className="text-slate-500" weight="duotone" />
          <p className="mt-2 text-sm font-medium text-white">Drag & drop logo here</p>
          <p className="mt-1 text-xs text-slate-500">PNG, JPG (max 2MB recommended)</p>
        </>
      )}
      {value && (
        <span className="mt-2 flex items-center gap-1 text-xs text-emerald">
          <ImageIcon size={14} /> Click or drop to replace
        </span>
      )}
    </div>
  );
}
