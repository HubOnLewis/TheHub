/**
 * Production CRM presentation guard.
 * - Prefer API/Mongo when records exist.
 * - Fall back to real Perfect Venue client import data (labeled as imported, not live).
 * - Block fake demo/mock placeholder data on Jason-facing pages.
 */

export const EMPTY_LIVE_MESSAGE = 'No live records found yet.';

/** True in production builds (admin.hubonlewis.com). */
export function isProductionCRM(): boolean {
  return import.meta.env.PROD;
}

/** Real Perfect Venue export/import data may be shown in production when API is empty. */
export function allowsImportedVenueData(): boolean {
  return isProductionCRM();
}

/** Runtime "Today · YYYY-MM-DD" label — never hardcoded snapshot dates. */
export function formatTodayLabel(date = new Date()): string {
  const iso = date.toLocaleDateString('en-CA');
  return `Today · ${iso}`;
}

export function formatRelativeDate(iso: string | Date | undefined | null): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function daysSince(iso: string | Date | undefined | null): number | null {
  if (!iso) return null;
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

/** Main nav routes hidden in production until wired to API/Mongo. */
export const PRODUCTION_HIDDEN_MAIN_NAV = new Set([
  '/marketing',
  '/marketing-blasts',
  '/referrals',
  '/monthly-scorecard',
]);

/** Routes that should show an honest empty gate instead of demo intel. */
export const PRODUCTION_GATED_ROUTE_PREFIXES = [
  '/today',
  '/owner-briefing',
  '/revenue-leaks',
  '/automation-impact',
  '/autopilot',
  '/inbox',
  '/calendar',
  '/tasks',
  '/my-work',
  '/follow-ups',
  '/pipeline-pressure',
  '/forecast-review',
  '/rep-scorecards',
  '/weekly-cadence',
  '/account-coverage',
  '/account-expansion',
  '/audit-trail',
  '/accounts',
  '/companies',
  '/marketing',
  '/marketing-blasts',
  '/referrals',
  '/monthly-scorecard',
] as const;

export function isProductionGatedRoute(pathname: string): boolean {
  if (!isProductionCRM()) return false;
  return PRODUCTION_GATED_ROUTE_PREFIXES.some(
    p => pathname === p || pathname.startsWith(`${p}/`),
  );
}