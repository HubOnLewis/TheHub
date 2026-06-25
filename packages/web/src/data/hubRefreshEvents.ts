/** Refresh event rows are served from Mongo in production — not committed (PII). */

import type { HubRefreshEvent } from './hubRefreshTypes.js';

export const HUB_REFRESH_EVENTS: HubRefreshEvent[] = [];
