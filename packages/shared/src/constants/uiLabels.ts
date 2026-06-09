// User-facing labels for The Hub CRM (internal enums/DB values may remain legacy).

/** Canonical Hub terminology for nav, titles, and empty states — avoid hardcoding mixed legacy names in UI. */
export const HUB_LABELS = {
  productName: 'The Hub CRM',
  account: 'Account',
  accounts: 'Accounts',
  contact: 'Contact',
  contacts: 'Contacts',
  lead: 'Lead',
  leads: 'Leads',
  opportunity: 'Opportunity',
  opportunities: 'Opportunities',
  booking: 'Booking',
  bookings: 'Bookings',
  activity: 'Activity',
  activities: 'Activities',
  followUp: 'Follow-up',
  followUps: 'Follow-ups',
  pipeline: 'Pipeline',
  insight: 'Insight',
  insights: 'Insights',
  closeout: 'Closeout',
  fulfillment: 'Fulfillment',
  proposal: 'Proposal',
  proposals: 'Proposals',
  client: 'Client',
  clients: 'Clients',
  adminWorkspace: 'Admin workspace',
  myWork: 'My Work',
  dashboard: 'Dashboard',
  /** Requirements / scope lines on a proposal (UI label; APIs may still say spec/build). */
  requirements: 'Requirements',
  /** Primary external identifier on a booking record (stored field may still be `vin`). */
  externalReference: 'External reference',
} as const;

/** Proposal/build workflow stages from stored status strings (API values unchanged). */
export const BUILD_STATUS_DISPLAY: Record<string, string> = {
  draft: 'Draft',
  quoted: 'Quoted',
  approved: 'Approved',
  in_production: 'In fulfillment',
  completed: 'Completed',
};

export function buildStatusForDisplay(status: string): string {
  return BUILD_STATUS_DISPLAY[status] ?? status.replace(/_/g, ' ');
}

/** Closeout / delivery-record stages (stored API values unchanged). */
export const DELIVERY_RECORD_STATUS_DISPLAY: Record<string, string> = {
  pending: 'Pending',
  ready_for_delivery: 'Ready for client handoff',
  scheduled: 'Handoff scheduled',
  delivered: 'Completed',
  closed: 'Closed',
};

export function deliveryRecordStatusForDisplay(status: string): string {
  return DELIVERY_RECORD_STATUS_DISPLAY[status] ?? status.replace(/_/g, ' ');
}

/** Maps stored deal status strings to Hub pipeline language. */
export const DEAL_STATUS_DISPLAY: Record<string, string> = {
  Draft: 'New lead / intake',
  'Pending Approval': 'Discovery / needs review',
  Approved: 'Proposal / quote sent',
  Won: 'Booked / won',
  'In Build': 'Fulfillment',
  Delivered: 'Completed',
  Lost: 'Lost / inactive',
};

export function dealStatusForDisplay(status: string): string {
  return DEAL_STATUS_DISPLAY[status] ?? status;
}

export const LEAD_STATUS_DISPLAY: Record<string, string> = {
  New: 'New lead',
  Contacted: 'Contacted',
  Working: 'Discovery / needs review',
  Quoted: 'Proposal / quote sent',
  Converted: 'Converted',
  Lost: 'Lost / inactive',
};

export function leadStatusForDisplay(status: string): string {
  return LEAD_STATUS_DISPLAY[status] ?? status;
}

/** Entity codes on user/records — always shown as the HuB venue (legacy codes normalized). */
export function entityForDisplay(_entity: string): string {
  return 'HuB on Lewis';
}

export const ROLE_DISPLAY: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  management: 'Management',
  sales: 'Sales',
  service: 'Service',
  parts: 'Parts',
};

export function roleForDisplay(role: string): string {
  return ROLE_DISPLAY[role] ?? role.replace(/_/g, ' ');
}

/** Legacy unit/booking workflow stages (stored values unchanged). */
export const UNIT_STATUS_DISPLAY: Record<string, string> = {
  prospect: 'Intake',
  ordered: 'Committed',
  in_build: 'Fulfillment',
  completed: 'Ready to close',
  delivered: 'Completed',
};

export function unitStatusForDisplay(status: string): string {
  return UNIT_STATUS_DISPLAY[status] ?? status.replace(/_/g, ' ');
}
