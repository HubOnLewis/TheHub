// packages/shared/src/constants/index.ts

export const ENTITIES = ['WKI', 'MTTE', 'PacLease'] as const;
export const LOCATIONS = ['Wichita', 'Dodge City', 'Salina', 'Liberal', 'Garden City'] as const;

export const ROLES = [
  'super_admin',
  'admin',
  'management',
  'sales',
  'service',
  'parts',
] as const;

/** Roles that can see across tenants (with optional header-based scope override) */
export const CROSS_TENANT_ROLES: readonly string[] = ['super_admin', 'admin', 'management'];

export const LEAD_STATUSES = [
  'New',
  'Contacted',
  'Working',
  'Quoted',
  'Converted',
  'Lost',
] as const;

export const DEAL_STATUSES = [
  'Draft',
  'Pending Approval',
  'Approved',
  'Won',
  'In Build',
  'Delivered',
  'Lost',
] as const;

export const UNIT_STATUSES = [
  'Available',
  'Reserved',
  'In Build',
  'Delivered',
  'Demo',
] as const;

export const ACTIVITY_TYPES = [
  'call_out',
  'call_in',
  'email_out',
  'email_in',
  'text_out',
  'text_in',
  'visit',
  'event',
  'other',
] as const;

export type Entity       = typeof ENTITIES[number];
export type Location     = typeof LOCATIONS[number];
export type UserRole     = typeof ROLES[number];
export type LeadStatus   = typeof LEAD_STATUSES[number];
export type DealStatus   = typeof DEAL_STATUSES[number];
export type UnitStatus   = typeof UNIT_STATUSES[number];
export type ActivityType = typeof ACTIVITY_TYPES[number];

/**
 * Build the tenant ID from an entity + location.
 * 'WKI' + 'Dodge City' → 'wki-dodge-city'
 */
export function buildTenantId(entity: Entity, location: Location): string {
  return `${entity.toLowerCase()}-${location.toLowerCase().replace(/\s+/g, '-')}`;
}
