/**
 * Production alpha navigation — four-screen venue desk.
 * Today · Calendar · Events · Settings
 *
 * Hannah (admin/staff): only the desk; advanced routes redirect to Today.
 * Jason (super_admin): desk nav, but advanced routes stay reachable.
 */

import { ROUTES } from './paths.js';

export type HubTopNavItem = {
  to: string;
  label: string;
  badge?: number;
  match?: (pathname: string) => boolean;
};

export type DeskRole = string | null | undefined;

export function isHubHomePath(pathname: string): boolean {
  return (
    pathname === ROUTES.dashboard ||
    pathname === ROUTES.opportunities ||
    pathname === ROUTES.dealsAlias ||
    pathname.startsWith(`${ROUTES.opportunities}/`) ||
    pathname.startsWith(`${ROUTES.dealsAlias}/`)
  );
}

function isHubSettingsPath(pathname: string): boolean {
  return pathname === ROUTES.settings || pathname.startsWith(`${ROUTES.settings}/`);
}

function isHubEventsPath(pathname: string): boolean {
  return (
    pathname === ROUTES.opportunities ||
    pathname === ROUTES.dealsAlias ||
    pathname.startsWith(`${ROUTES.opportunities}/`) ||
    pathname.startsWith(`${ROUTES.dealsAlias}/`)
  );
}

export function isSuperAdminRole(role: DeskRole): boolean {
  return role === 'super_admin';
}

/** Duplicate work queues — always fold into Today for every staff role. */
export const DESK_QUEUE_REDIRECT_ROUTES: readonly string[] = [
  ROUTES.dashboard,
  ROUTES.tasks,
  ROUTES.followUps,
  ROUTES.inbox,
  ROUTES.leads,
];

/** Advanced modules — hidden from Hannah; Jason/admin may keep them. */
export const DESK_ADVANCED_REDIRECT_ROUTES: readonly string[] = [
  ROUTES.autopilot,
  ROUTES.revenueLeaks,
  ROUTES.automationImpact,
  ROUTES.myWork,
  ROUTES.audit,
  ROUTES.marketing,
  ROUTES.marketingBlasts,
  ROUTES.referrals,
  ROUTES.pipeline,
  ROUTES.insights,
  ROUTES.repScorecards,
  ROUTES.weeklyCadence,
  ROUTES.accountCoverage,
  ROUTES.accountExpansion,
  ROUTES.ownerBriefing,
  ROUTES.monthlyScorecard,
  ROUTES.prospects,
  ROUTES.accounts,
  ROUTES.companiesAlias,
  ROUTES.contacts,
  ROUTES.financial,
  ROUTES.admin,
  ROUTES.userManagement,
  `${ROUTES.settings}/express-book`,
];

/** @deprecated use DESK_QUEUE + DESK_ADVANCED */
export const PRODUCTION_ALPHA_REDIRECT_ROUTES: readonly string[] = [
  ...DESK_QUEUE_REDIRECT_ROUTES,
  ...DESK_ADVANCED_REDIRECT_ROUTES,
];

export function isProductionAlphaRedirectPath(routePath: string, role?: DeskRole): boolean {
  if (isHubEventsPath(routePath) || isHubSettingsPath(routePath)) return false;
  if (routePath === ROUTES.today || routePath === ROUTES.calendar) return false;
  if (routePath.startsWith(`${ROUTES.leads}/`)) return false;

  if (DESK_QUEUE_REDIRECT_ROUTES.some(r => routePath === r || routePath.startsWith(`${r}/`))) {
    return true;
  }

  // Jason keeps admin, briefing, reports, accounts — Hannah does not.
  if (isSuperAdminRole(role)) return false;

  return DESK_ADVANCED_REDIRECT_ROUTES.some(
    r => routePath === r || routePath.startsWith(`${r}/`),
  );
}

export function productionAlphaRedirectTarget(_routePath: string): string {
  return ROUTES.today;
}

const DESK_TOP_NAV: HubTopNavItem[] = [
  {
    to: ROUTES.today,
    label: 'Today',
    match: p => p === ROUTES.today || p === ROUTES.dashboard,
  },
  { to: ROUTES.calendar, label: 'Calendar' },
  {
    to: ROUTES.opportunities,
    label: 'Events',
    match: isHubEventsPath,
  },
  {
    to: ROUTES.settings,
    label: 'Settings',
    match: isHubSettingsPath,
  },
];

export function getHubTopNavItems(opts?: {
  inboxBadge?: number;
  tasksBadge?: number;
  role?: DeskRole;
}): HubTopNavItem[] {
  void opts?.role;
  return DESK_TOP_NAV.map(item => {
    if (item.to === ROUTES.today && opts?.tasksBadge != null && opts.tasksBadge > 0) {
      return { ...item, badge: opts.tasksBadge };
    }
    return item;
  });
}

export const CRM_TOPNAV_PATHS: readonly string[] = [
  ROUTES.today,
  ROUTES.calendar,
  ROUTES.opportunities,
  ROUTES.dealsAlias,
  ROUTES.settings,
];
