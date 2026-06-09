/**
 * Client-side feature flags (Vite `import.meta.env`).
 * Legacy-adapted modules default OFF in navigation; enable via `.env` for teams still using fulfillment/booking paths.
 * API routes are unchanged — flags only affect primary nav visibility and gated page shells.
 */

function readBool(envVal: string | undefined, defaultValue: boolean): boolean {
  if (envVal === undefined || envVal === '') return defaultValue;
  return envVal === 'true' || envVal === '1' || envVal === 'yes';
}

/**
 * When env var is unset: in Vite dev server, legacy modules default ON for local testing;
 * in production builds, they default OFF for client-safe demos unless explicitly enabled.
 */
const defaultLegacyOn = import.meta.env.DEV;

export type LegacyModuleKey = 'bookings' | 'fulfillment' | 'closeout' | 'builds' | 'legacyImportsUi';

export const hubFeatures = {
  /** Bookings UI (maps to legacy `units` API). */
  bookings: readBool(import.meta.env['VITE_FEATURE_BOOKINGS'], defaultLegacyOn),
  /** Fulfillment / shop workflow (legacy `production` API). */
  fulfillment: readBool(import.meta.env['VITE_FEATURE_FULFILLMENT'], defaultLegacyOn),
  /** Client closeout & packets (legacy `delivery` API). */
  closeout: readBool(import.meta.env['VITE_FEATURE_CLOSEOUT'], defaultLegacyOn),
  /** Proposal / scope workspace (legacy `builds` API). */
  builds: readBool(import.meta.env['VITE_FEATURE_BUILDS'], defaultLegacyOn),
  /** Reserved: surface legacy-import tooling in admin when wired. */
  legacyImportsUi: readBool(import.meta.env['VITE_FEATURE_LEGACY_IMPORTS_UI'], false),
} as const;

export function isLegacyModuleEnabled(key: LegacyModuleKey): boolean {
  return hubFeatures[key];
}
