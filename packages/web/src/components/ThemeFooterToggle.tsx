import { useAppStore } from '../store/index.js';

export default function ThemeFooterToggle({ collapsed }: { collapsed: boolean }) {
  const theme = useAppStore(s => s.theme);
  const setTheme = useAppStore(s => s.setTheme);
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className="theme-footer-toggle"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={isDark ? 'Return to light mode (default)' : 'Optional command-center dark mode'}
      aria-pressed={isDark}
    >
      <span className="theme-footer-toggle__icon" aria-hidden>
        {isDark ? '☀' : '◐'}
      </span>
      {!collapsed && (
        <span className="theme-footer-toggle__label">{isDark ? 'Light mode' : 'Dark mode'}</span>
      )}
    </button>
  );
}
