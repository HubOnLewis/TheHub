import type { AppUser } from '../store/index.js';
import { HUB_CONTACT_EMAILS } from '@hub-crm/shared';

/** Stored in localStorage as `hub_crm_token` together with zustand `hub-crm-auth` persist. */
export const SCREENSHOT_DEMO_TOKEN = 'hub-screenshot-local-dev-token';

export function getScreenshotDemoUser(): AppUser {
  return {
    id:       'screenshot-hub-admin',
    name:     'Jason Lavender',
    email:    HUB_CONTACT_EMAILS.jason,
    role:     'super_admin',
    entity:   'HUB',
    location: 'Wichita',
    tenantId: 'hub-wichita',
  };
}
