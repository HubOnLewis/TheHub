/** Demo user roster — HuB on Lewis client review (UI-only). */

import { HUB_CONTACT_EMAILS, HUB_PUBLIC_CONTACT_EMAIL } from '@hub-crm/shared';

export type DemoUserStatus = 'active' | 'invited' | 'disabled';

export interface DemoManagedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: DemoUserStatus;
  lastLogin: string;
  permissionsSummary: string;
}

export const DEMO_MANAGED_USERS: DemoManagedUser[] = [
  {
    id: 'u-jason',
    name: 'Jason Lavender',
    email: HUB_CONTACT_EMAILS.jason,
    role: 'Owner / Admin',
    status: 'active',
    lastLogin: 'Today · 7:02a',
    permissionsSummary: 'Full venue · billing · Autopilot approvals · owner briefing',
  },
  {
    id: 'u-hannah',
    name: 'Hannah Bayless',
    email: HUB_CONTACT_EMAILS.hannah,
    role: 'Event Coordinator / Admin',
    status: 'active',
    lastLogin: 'Yesterday · 4:18p',
    permissionsSummary: 'Admin — calendar, proposals, inbox, tasks, notifications',
  },
  {
    id: 'u-jaden',
    name: 'Jaden',
    email: HUB_CONTACT_EMAILS.jaden,
    role: 'Admin',
    status: 'active',
    lastLogin: 'May 19 · 9:15a',
    permissionsSummary: 'Admin — venue operations, leads, events, integrations',
  },
  {
    id: 'u-info',
    name: 'Hub on Lewis',
    email: HUB_PUBLIC_CONTACT_EMAIL,
    role: 'Public contact',
    status: 'active',
    lastLogin: 'Shared inbox',
    permissionsSummary: 'Public contact identity — not a human admin login',
  },
];
