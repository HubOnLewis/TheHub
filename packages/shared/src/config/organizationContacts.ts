/**
 * Centralized Hub on Lewis organization contact + access configuration.
 * Future auth should consume HUB_TEAM_ACCESS rather than scattering email strings.
 */

export const HUB_CONTACT_EMAILS = {
  info: 'info@hubonlewis.com',
  hannah: 'hannah@hubonlewis.com',
  jason: 'jason@hubonlewis.com',
  jaden: 'jaden@hubonlewis.com',
} as const;

export type HubContactEmail = (typeof HUB_CONTACT_EMAILS)[keyof typeof HUB_CONTACT_EMAILS];

/** Public-facing default contact / shared inbox identity */
export const HUB_PUBLIC_CONTACT_EMAIL = HUB_CONTACT_EMAILS.info;

/** Admin operators — used for admin/event/lead notification routing */
export const HUB_ADMIN_EMAILS: readonly HubContactEmail[] = [
  HUB_CONTACT_EMAILS.hannah,
  HUB_CONTACT_EMAILS.jason,
  HUB_CONTACT_EMAILS.jaden,
];

export const HUB_ADMIN_NOTIFICATION_EMAILS: readonly HubContactEmail[] = HUB_ADMIN_EMAILS;

export function normalizeHubEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isHubAdminEmail(email: string): boolean {
  const normalized = normalizeHubEmail(email);
  return HUB_ADMIN_EMAILS.some(e => e === normalized);
}

export type HubAccessLevel = 'public_contact' | 'admin' | 'staff';

export interface HubTeamMemberConfig {
  email: HubContactEmail;
  name: string;
  accessLevel: HubAccessLevel;
  /** Maps to CRM ROLES when full auth is wired */
  crmRole?: 'super_admin' | 'admin' | 'management' | 'sales';
  isLoginUser: boolean;
  permissionsSummary: string;
}

export const HUB_TEAM_ACCESS: readonly HubTeamMemberConfig[] = [
  {
    email: HUB_CONTACT_EMAILS.info,
    name: 'Hub on Lewis',
    accessLevel: 'public_contact',
    isLoginUser: false,
    permissionsSummary: 'Public contact / shared inbox identity — not a human admin login',
  },
  {
    email: HUB_CONTACT_EMAILS.hannah,
    name: 'Hannah Bayless',
    accessLevel: 'admin',
    crmRole: 'admin',
    isLoginUser: true,
    permissionsSummary: 'Admin — calendar, proposals, inbox, tasks, notifications',
  },
  {
    email: HUB_CONTACT_EMAILS.jason,
    name: 'Jason Lavender',
    accessLevel: 'admin',
    crmRole: 'super_admin',
    isLoginUser: true,
    permissionsSummary: 'Admin — full venue, billing, user management, owner briefing',
  },
  {
    email: HUB_CONTACT_EMAILS.jaden,
    name: 'Jaden',
    accessLevel: 'admin',
    crmRole: 'admin',
    isLoginUser: true,
    permissionsSummary: 'Admin — venue operations, leads, events, integrations',
  },
];

export function getHubTeamMember(email: string): HubTeamMemberConfig | undefined {
  const normalized = normalizeHubEmail(email);
  return HUB_TEAM_ACCESS.find(m => m.email === normalized);
}
