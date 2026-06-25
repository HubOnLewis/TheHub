/**
 * Hub-friendly client routes (aliases preserve bookmarks to legacy paths).
 */

export const ROUTES = {
  dashboard: '/dashboard',
  /** Operational mission control — what needs attention right now */
  today: '/today',
  /** The Hub Autopilot — agent workforce command center (UI-only demo) */
  autopilot: '/autopilot',
  /** Executive intelligence — owner / revenue / automation (demo-forward) */
  ownerBriefing: '/owner-briefing',
  revenueLeaks: '/revenue-leaks',
  automationImpact: '/automation-impact',
  myWork: '/my-work',
  leads: '/leads',
  /** Canonical list path; `/companies` remains an alias. */
  accounts: '/accounts',
  /** Canonical opportunity list; `/deals` remains an alias. */
  opportunities: '/opportunities',
  followUps: '/follow-ups',
  pipeline: '/pipeline-pressure',
  insights: '/forecast-review',
  repScorecards: '/rep-scorecards',
  weeklyCadence: '/weekly-cadence',
  accountCoverage: '/account-coverage',
  accountExpansion: '/account-expansion',
  admin: '/admin',
  tasks: '/tasks',
  calendar: '/calendar',
  inbox: '/inbox',
  /** Venue settings hub (visual modules — Phase 5) */
  settings: '/settings',
  userManagement: '/user-management',
  reviewNotes: '/review-notes',
  /** Operational audit trail — who did what */
  audit: '/audit-trail',
  /** Legacy aliases — same screens */
  companiesAlias: '/companies',
  dealsAlias: '/deals',
  bookings: '/bookings',
  bookingsLegacy: '/units',
  proposals: '/proposals',
  proposalsLegacy: '/builds',
  fulfillment: '/fulfillment',
  fulfillmentLegacy: '/production',
  closeout: '/closeout',
  closeoutLegacy: '/delivery',
  /** Launch readiness — growth & compliance */
  privacy: '/privacy',
  terms: '/terms',
  prospects: '/prospects',
  marketing: '/marketing',
  /** @deprecated alias — redirects to /marketing */
  marketingBlasts: '/marketing-blasts',
  referrals: '/referrals',
  monthlyScorecard: '/monthly-scorecard',
} as const;

/** Routes that use the simplified client shell (no ops rail / demo flow). */
export const CLIENT_SIMPLE_PATHS: readonly string[] = [
  ROUTES.dashboard,
  ROUTES.leads,
  ROUTES.prospects,
  ROUTES.opportunities,
  ROUTES.dealsAlias,
  ROUTES.inbox,
  ROUTES.calendar,
  ROUTES.tasks,
  ROUTES.marketing,
  ROUTES.marketingBlasts,
  ROUTES.referrals,
  ROUTES.monthlyScorecard,
  ROUTES.settings,
  ROUTES.privacy,
  ROUTES.terms,
];

export const PUBLIC_ROUTES = {
  privacy: '/privacy',
  terms: '/terms',
  referral: '/r',
} as const;

export function referralPath(code: string): string {
  return `${PUBLIC_ROUTES.referral}/${encodeURIComponent(code)}`;
}

export function accountDetailPath(id: string): string {
  return `${ROUTES.accounts}/${id}`;
}

export function opportunityDetailPath(id: string): string {
  return `${ROUTES.opportunities}/${id}`;
}
