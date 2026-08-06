import { Moon, Sun } from '@phosphor-icons/react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label="Toggle theme"
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-slate-800/60 text-slate-200 transition hover:bg-slate-700 hover:text-white dark:border-white/10 dark:bg-slate-800/60 light:border-slate-300 light:bg-white light:text-slate-700 light:hover:bg-slate-100 ${className}`}
    >
      {isDark ? <Sun size={18} weight="fill" className="text-gold" /> : <Moon size={18} weight="fill" />}
    </button>
  );
}
