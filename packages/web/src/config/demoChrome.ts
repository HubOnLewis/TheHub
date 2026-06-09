import { isScreenshotMode } from './screenshotMode.js';

/** Internal walkthrough / dev tooling — hidden in normal client demo. */
export function isInternalDemoChromeEnabled(): boolean {
  return Boolean(
    import.meta.env.DEV &&
      (import.meta.env.VITE_CLIENT_WALKTHROUGH === 'true' || isScreenshotMode()),
  );
}

export function isKpiDiagnosticsEnabled(): boolean {
  return Boolean(import.meta.env.DEV && import.meta.env.VITE_KPI_DIAGNOSTICS === 'true');
}
