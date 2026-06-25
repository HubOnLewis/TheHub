/**
 * Local-only refresh event rows — populated by `npm run import:hub-refresh:apply` on dev machines.
 * Not committed (contains PII). Live CRM reads from Mongo after apply.
 */

import type { HubRefreshEvent } from './hubRefreshTypes.js';

export const HUB_REFRESH_EVENTS: HubRefreshEvent[] = [];
