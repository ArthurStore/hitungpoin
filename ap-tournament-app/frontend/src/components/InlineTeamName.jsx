import { useEffect, useRef, useState } from 'react';
import { PencilSimple } from '@phosphor-icons/react';

/**
 * Click-to-edit team name. Commits on Enter/blur; Esc cancels.
 */
export default function InlineTeamName({
  name,
  onSave,
  className = '',
  inputClassName = '',
  disabled = false,
  showIcon = true,
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name || '');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    setValue(name || '');
  }, [name]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = async () => {
    const next = value.trim();
    if (!next || next === name) {
      setValue(name || '');
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave?.(next);
      setEditing(false);
    } catch {
      setValue(name || '');
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        disabled={saving || disabled}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
          if (e.key === 'Escape') {
            setValue(name || '');
            setEditing(false);
          }
        }}
        className={inputClassName || 'w-full min-w-0 rounded border border-cyan-400/50 bg-slate-900 px-1.5 py-0.5 font-bold uppercase text-white outline-none'}
      />
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && setEditing(true)}
      title="Klik untuk edit nama tim"
      className={`group inline-flex max-w-full items-center gap-1 text-left ${className}`}
    >
      <span className="truncate">{name}</span>
      {showIcon && (
        <PencilSimple size={12} className="shrink-0 opacity-0 transition group-hover:opacity-70" />
      )}
    </button>
  );
}
