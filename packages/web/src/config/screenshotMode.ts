/**
 * Local dev-only screenshot mode: full UI without API/MongoDB.
 * Requires Vite dev server (`import.meta.env.DEV`) so production builds never activate,
 * even if `VITE_SCREENSHOT_MODE` were mis-set on the host.
 */
export function isScreenshotMode(): boolean {
  return Boolean(import.meta.env.DEV && import.meta.env.VITE_SCREENSHOT_MODE === 'true');
}
