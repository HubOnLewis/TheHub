/**
 * Nested path segments for routes rendered under App's `/portal/*` parent.
 * Must stay relative — absolute `/portal/...` breaks when
 * `future.v7_relativeSplatPath` is enabled (remainder is `login`, not `/portal/login`).
 *
 * Public browser URLs remain `/portal/login` etc. via PORTAL_ROUTES in paths.ts.
 */

export const PORTAL_NESTED = {
  login: 'login',
  dashboard: 'dashboard',
  event: 'event/:id',
  payments: 'payments',
  documents: 'documents',
  messages: 'messages',
  timeline: 'timeline',
  checklist: 'checklist',
  guests: 'guests',
  details: 'details',
  designBoard: 'design-board',
  settings: 'settings',
} as const;

/** Absolute public URLs guests and staff share links for. */
export function portalPublicUrl(nested: string, query?: string): string {
  const base = nested.startsWith('/') ? nested : `/portal/${nested}`;
  return query ? `${base}?${query}` : base;
}
