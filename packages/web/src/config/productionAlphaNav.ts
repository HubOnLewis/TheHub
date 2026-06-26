/**
 * Production alpha navigation — only expose client-ready modules in the top nav.
 */

import { ROUTES } from './paths.js';
import { isProductionCRM } from './productionData.js';

export type HubTopNavItem = {
  to: string;
  label: string;
  badge?: number;
  match?: (pathname: string) => boolean;
};

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

/** Routes that redirect to Home in production alpha (internal / unwired modules only). */
export const PRODUCTION_ALPHA_REDIRECT_ROUTES: readonly string[] = [
  ROUTES.today,
  ROUTES.autopilot,
  ROUTES.ownerBriefing,
  ROUTES.revenueLeaks,
  ROUTES.automationImpact,
  ROUTES.myWork,
  ROUTES.followUps,
  ROUTES.audit,
  ROUTES.accounts,
  ROUTES.companiesAlias,
  ROUTES.prospects,
  ROUTES.marketing,
  ROUTES.marketingBlasts,
  ROUTES.referrals,
  ROUTES.pipeline,
  ROUTES.insights,
  ROUTES.repScorecards,
  ROUTES.weeklyCadence,
  ROUTES.accountCoverage,
  ROUTES.accountExpansion,
  `${ROUTES.settings}/express-book`,
];

export function isProductionAlphaRedirectPath(routePath: string): boolean {
  if (!isProductionCRM()) return false;
  if (isHubHomePath(routePath) || isHubSettingsPath(routePath)) return false;
  if (
    routePath === ROUTES.inbox ||
    routePath === ROUTES.calendar ||
    routePath === ROUTES.tasks ||
    routePath === ROUTES.monthlyScorecard ||
    routePath === ROUTES.leads ||
    routePath.startsWith(`${ROUTES.leads}/`)
  ) {
    return false;
  }
  if (routePath === ROUTES.admin || routePath.startsWith(`${ROUTES.admin}/`)) return false;
  if (routePath === ROUTES.userManagement || routePath.startsWith(`${ROUTES.userManagement}/`)) {
    return false;
  }
  return PRODUCTION_ALPHA_REDIRECT_ROUTES.some(
    r => routePath === r || routePath.startsWith(`${r}/`),
  );
}

const FULL_HUB_TOP_NAV: HubTopNavItem[] = [
  {
    to: ROUTES.dashboard,
    label: 'Home',
    match: isHubHomePath,
  },
  {
    to: ROUTES.leads,
    label: 'Leads',
    match: p => p === ROUTES.leads || p.startsWith(`${ROUTES.leads}/`),
  },
  { to: ROUTES.inbox, label: 'Inbox' },
  { to: ROUTES.calendar, label: 'Calendar' },
  { to: ROUTES.tasks, label: 'Tasks' },
  { to: ROUTES.monthlyScorecard, label: 'Reports' },
  {
    to: ROUTES.settings,
    label: 'Settings',
    match: isHubSettingsPath,
  },
];

const ALPHA_HUB_TOP_NAV: HubTopNavItem[] = FULL_HUB_TOP_NAV;

export function getHubTopNavItems(opts?: {
  inboxBadge?: number;
  tasksBadge?: number;
}): HubTopNavItem[] {
  const nav = isProductionCRM() ? ALPHA_HUB_TOP_NAV : FULL_HUB_TOP_NAV;

  return nav.map(item => {
    if (item.to === ROUTES.inbox && opts?.inboxBadge != null && opts.inboxBadge > 0) {
      return { ...item, badge: opts.inboxBadge };
    }
    if (item.to === ROUTES.tasks && opts?.tasksBadge != null && opts.tasksBadge > 0) {
      return { ...item, badge: opts.tasksBadge };
    }
    return item;
  });
}

export const CRM_TOPNAV_PATHS: readonly string[] = [
  ROUTES.dashboard,
  ROUTES.leads,
  ROUTES.opportunities,
  ROUTES.dealsAlias,
  ROUTES.inbox,
  ROUTES.calendar,
  ROUTES.tasks,
  ROUTES.monthlyScorecard,
  ROUTES.settings,
];
