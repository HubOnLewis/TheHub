import { HUB_REFRESH_AVAILABLE } from './hubRefreshManifest.js';
import { HUB_REFRESH_EVENTS } from './hubRefreshEvents.js';
import type { HubRefreshEvent } from './hubRefreshTypes.js';

export type { HubRefreshEvent, HubRefreshPayment } from './hubRefreshTypes.js';

export function getHubRefreshEvents(): HubRefreshEvent[] {
  return HUB_REFRESH_AVAILABLE ? HUB_REFRESH_EVENTS : [];
}

export function getHubRefreshEventById(id: string): HubRefreshEvent | undefined {
  return getHubRefreshEvents().find(e => e.id === id);
}
