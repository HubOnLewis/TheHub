import { useAppStore } from '../../store/index.js';

/** Compact theme toggle for PV-style top nav. */
export default function HubThemeToggle() {
  const theme = useAppStore(s => s.theme);
  const setTheme = useAppStore(s => s.setTheme);
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className="crm-topnav__icon"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
    >
      {isDark ? '☀' : '◐'}
    </button>
  );
}
