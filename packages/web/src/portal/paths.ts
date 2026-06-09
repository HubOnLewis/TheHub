/** Client portal routes — separate from internal CRM paths */

export const PORTAL_ROUTES = {
  root: '/portal',
  login: '/portal/login',
  dashboard: '/portal/dashboard',
  event: (id: string) => `/portal/event/${id}`,
  payments: '/portal/payments',
  documents: '/portal/documents',
  messages: '/portal/messages',
  timeline: '/portal/timeline',
  checklist: '/portal/checklist',
  guests: '/portal/guests',
  designBoard: '/portal/design-board',
  settings: '/portal/settings',
} as const;

export const PORTAL_DEMO_EVENT_ID = 'pv-miller-harris';
