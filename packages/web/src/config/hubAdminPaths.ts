import { ROUTES } from './paths.js';

/** Routes that use the Perfect Venue–style top-nav client shell. */
export const HUB_ADMIN_PATH_PREFIXES: readonly string[] = [
  ROUTES.dashboard,
  ROUTES.opportunities,
  ROUTES.dealsAlias,
  ROUTES.inbox,
  ROUTES.calendar,
  ROUTES.tasks,
  ROUTES.monthlyScorecard,
  ROUTES.settings,
  ROUTES.admin,
  ROUTES.autopilot,
  ROUTES.today,
  ROUTES.followUps,
  ROUTES.accounts,
  ROUTES.companiesAlias,
  ROUTES.leads,
  ROUTES.prospects,
  ROUTES.marketing,
  ROUTES.referrals,
  ROUTES.myWork,
  ROUTES.audit,
  ROUTES.userManagement,
  ROUTES.ownerBriefing,
  ROUTES.revenueLeaks,
  ROUTES.automationImpact,
];

const DETAIL_PATTERNS = [
  /^\/opportunities\/[^/]+/,
  /^\/deals\/[^/]+/,
  /^\/accounts\/[^/]+/,
  /^\/companies\/[^/]+/,
];

export function usesHubAdminShell(pathname: string): boolean {
  if (DETAIL_PATTERNS.some(re => re.test(pathname))) return true;
  return HUB_ADMIN_PATH_PREFIXES.some(
    p => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/** @deprecated Use usesHubAdminShell */
export function usesCrmTopNav(pathname: string): boolean {
  return usesHubAdminShell(pathname);
}
