/**
 * Production navigation for the full Hub venue CRM.
 *
 * Goal:
 * - keep the daily staff experience simple
 * - keep every real product surface reachable
 * - group lower-frequency capabilities instead of hiding/redirecting them
 */

import { ROUTES } from './paths.js';

export type HubNavItem = {
  to: string;
  label: string;
  badge?: number;
  match?: (pathname: string) => boolean;
  superAdminOnly?: boolean;
};

export type HubNavSection = {
  id: string;
  label: string;
  items: HubNavItem[];
  defaultOpen?: boolean;
};

export type DeskRole = string | null | undefined;

export function isHubHomePath(pathname: string): boolean {
  return pathname === ROUTES.today || pathname === ROUTES.dashboard;
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

function prefixMatch(path: string) {
  return (pathname: string) => pathname === path || pathname.startsWith(`${path}/`);
}

export function isSuperAdminRole(role: DeskRole): boolean {
  return role === 'super_admin';
}

/**
 * The old four-screen desk redirected real product modules back to Today.
 * That hid working features from staff. Only the obsolete dashboard alias
 * now redirects; real modules remain reachable.
 */
export const DESK_QUEUE_REDIRECT_ROUTES: readonly string[] = [ROUTES.dashboard];
export const DESK_ADVANCED_REDIRECT_ROUTES: readonly string[] = [];
export const PRODUCTION_ALPHA_REDIRECT_ROUTES: readonly string[] = [ROUTES.dashboard];

/**
 * Owner/admin-only tooling — same set flagged `superAdminOnly` in
 * getHubNavSections below. The sidebar already hides these from Hannah;
 * this is what stops her from reaching them directly by URL.
 */
const SUPER_ADMIN_ONLY_ROUTES: readonly string[] = [ROUTES.admin, ROUTES.userManagement];

export function isProductionAlphaRedirectPath(routePath: string, role?: DeskRole): boolean {
  if (routePath === ROUTES.dashboard) return true;
  if (!isSuperAdminRole(role) && SUPER_ADMIN_ONLY_ROUTES.some(r => prefixMatch(r)(routePath))) {
    return true;
  }
  return false;
}

export function productionAlphaRedirectTarget(_routePath: string): string {
  return ROUTES.today;
}

export function getHubNavSections(opts?: {
  tasksBadge?: number;
  role?: DeskRole;
}): HubNavSection[] {
  const isSuper = isSuperAdminRole(opts?.role);
  const sections: HubNavSection[] = [
    {
      id: 'work',
      label: 'Workspace',
      defaultOpen: true,
      items: [
        {
          to: ROUTES.today,
          label: 'Today',
          badge: opts?.tasksBadge && opts.tasksBadge > 0 ? opts.tasksBadge : undefined,
          match: p => p === ROUTES.today || p === ROUTES.dashboard,
        },
        { to: ROUTES.teamToday, label: 'Team Today', match: prefixMatch(ROUTES.teamToday) },
        { to: ROUTES.leads, label: 'Leads', match: prefixMatch(ROUTES.leads) },
        { to: ROUTES.calendar, label: 'Calendar', match: prefixMatch(ROUTES.calendar) },
        { to: ROUTES.opportunities, label: 'Events', match: isHubEventsPath },
        { to: ROUTES.tasks, label: 'Tasks', match: prefixMatch(ROUTES.tasks) },
        { to: ROUTES.inbox, label: 'Inbox', match: prefixMatch(ROUTES.inbox) },
        { to: ROUTES.followUps, label: 'Follow-ups', match: prefixMatch(ROUTES.followUps) },
      ],
    },
    {
      id: 'ai',
      label: 'AI & Automation',
      defaultOpen: true,
      items: [
        { to: ROUTES.autopilot, label: 'AI Agents', match: prefixMatch(ROUTES.autopilot) },
      ],
    },
    {
      id: 'business',
      label: 'Clients & Money',
      items: [
        { to: ROUTES.accounts, label: 'Accounts', match: prefixMatch(ROUTES.accounts) },
        { to: ROUTES.contacts, label: 'Contacts', match: prefixMatch(ROUTES.contacts) },
        { to: ROUTES.financial, label: 'Financial', match: prefixMatch(ROUTES.financial) },
      ],
    },
    {
      id: 'insights',
      label: 'Insights',
      items: [
        { to: ROUTES.ownerBriefing, label: 'Owner Briefing', match: prefixMatch(ROUTES.ownerBriefing) },
        { to: ROUTES.monthlyScorecard, label: 'Reports', match: prefixMatch(ROUTES.monthlyScorecard) },
        { to: ROUTES.revenueLeaks, label: 'Revenue Leaks', match: prefixMatch(ROUTES.revenueLeaks) },
      ],
    },
    {
      id: 'admin',
      label: 'Admin',
      items: [
        { to: ROUTES.audit, label: 'Audit Trail', match: prefixMatch(ROUTES.audit) },
        { to: ROUTES.settings, label: 'Settings', match: isHubSettingsPath },
        { to: ROUTES.admin, label: 'Admin Workspace', match: prefixMatch(ROUTES.admin), superAdminOnly: true },
        { to: ROUTES.userManagement, label: 'Users', match: prefixMatch(ROUTES.userManagement), superAdminOnly: true },
      ].filter(item => !item.superAdminOnly || isSuper),
    },
  ];

  return sections.filter(section => section.items.length > 0);
}

/** Compatibility helper for any legacy callers. */
export function getHubTopNavItems(opts?: {
  inboxBadge?: number;
  tasksBadge?: number;
  role?: DeskRole;
}): HubNavItem[] {
  void opts?.inboxBadge;
  return getHubNavSections(opts).flatMap(section => section.items);
}

export const CRM_TOPNAV_PATHS: readonly string[] = [
  ROUTES.today,
  ROUTES.teamToday,
  ROUTES.leads,
  ROUTES.calendar,
  ROUTES.opportunities,
  ROUTES.tasks,
  ROUTES.inbox,
  ROUTES.followUps,
  ROUTES.autopilot,
  ROUTES.accounts,
  ROUTES.contacts,
  ROUTES.financial,
  ROUTES.ownerBriefing,
  ROUTES.monthlyScorecard,
  ROUTES.pipeline,
  ROUTES.insights,
  ROUTES.revenueLeaks,
  ROUTES.marketing,
  ROUTES.referrals,
  ROUTES.audit,
  ROUTES.settings,
  ROUTES.admin,
  ROUTES.userManagement,
];
