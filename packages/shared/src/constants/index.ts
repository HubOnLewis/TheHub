// packages/shared/src/constants/index.ts

/** HuB on Lewis — single-venue deployment (Wichita only). */
export const ENTITIES = ['HUB'] as const;
export const LOCATIONS = ['Wichita'] as const;

export type Entity   = (typeof ENTITIES)[number];
export type Location = (typeof LOCATIONS)[number];

export const DEFAULT_ENTITY: Entity = 'HUB';
export const DEFAULT_LOCATION: Location = 'Wichita';
export const VENUE_NAME = 'HuB on Lewis';
export const VENUE_FULL_LABEL = `${VENUE_NAME} · Wichita, KS`;

/** True when the deployment exposes one entity × one location (hide pickers in forms). */
export const IS_SINGLE_VENUE = ENTITIES.length === 1 && LOCATIONS.length === 1;

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
  'prospect',
  'ordered',
  'in_build',
  'completed',
  'delivered',
] as const;

export const BUILD_STATUSES = [
  'draft',
  'quoted',
  'approved',
  'in_production',
  'completed',
] as const;
export const BUILD_SPEC_ITEM_CATEGORIES = [
  'body',
  'hydraulics',
  'electrical',
  'lighting',
  'accessories',
  'labor',
  'freight',
  'misc',
] as const;
export const BUILD_COST_SOURCES = ['manual', 'standard', 'substituted'] as const;
export const BUILD_PRICING_SOURCES = ['manual', 'template', 'quoted'] as const;
export const CHANGE_ORDER_STATUSES = ['draft', 'pending_approval', 'approved', 'rejected'] as const;
export const PRODUCTION_JOB_STATUSES = ['queued', 'ready', 'in_progress', 'paused', 'completed'] as const;
export const PRODUCTION_TASK_CATEGORIES = [
  'body',
  'hydraulics',
  'electrical',
  'lighting',
  'fabrication',
  'paint',
  'install',
  'inspection',
  'final',
] as const;
export const PRODUCTION_TASK_STATUSES = ['not_started', 'ready', 'in_progress', 'blocked', 'completed'] as const;
export const DELIVERY_RECORD_STATUSES = ['pending', 'ready_for_delivery', 'scheduled', 'delivered', 'closed'] as const;

/** Customer delivery packet lifecycle — handoff control, not document generation */
export const DELIVERY_PACKET_STATUSES = ['draft', 'ready', 'issued'] as const;

export const POST_DELIVERY_FOLLOW_UP_STATUSES = ['pending', 'scheduled', 'completed', 'skipped'] as const;

export const POST_DELIVERY_FOLLOW_UP_TYPES = ['check_in', 'issue_review', 'service_intro', 'warranty_intro'] as const;

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

/** Core interaction domain (first-class, replaces ad-hoc activities for manual logging) */
export const INTERACTION_TYPES = [
  'call',
  'text',
  'email',
  'meeting',
  'note',
  'task',
  'visit',
] as const;

export const INTERACTION_DIRECTIONS = ['inbound', 'outbound'] as const;

export const INTERACTION_STATUS = ['open', 'completed'] as const;

export const INTERACTION_OUTCOMES = [
  'connected',
  'left_vm',
  'no_answer',
  'quote_sent',
  'meeting_scheduled',
  'info_requested',
  'callback_requested',
  'other',
] as const;

export const ATTACHMENT_TYPES = ['image', 'document'] as const;
export const ACCOUNT_PLAN_STATUSES = ['draft', 'active', 'paused', 'completed'] as const;

export type UserRole     = typeof ROLES[number];
export type LeadStatus   = typeof LEAD_STATUSES[number];
export type DealStatus   = typeof DEAL_STATUSES[number];
export type UnitStatus   = typeof UNIT_STATUSES[number];
export type BuildStatus  = typeof BUILD_STATUSES[number];
export type BuildSpecItemCategory = typeof BUILD_SPEC_ITEM_CATEGORIES[number];
export type BuildCostSource = typeof BUILD_COST_SOURCES[number];
export type BuildPricingSource = typeof BUILD_PRICING_SOURCES[number];
export type ChangeOrderStatus = typeof CHANGE_ORDER_STATUSES[number];
export type ProductionJobStatus = typeof PRODUCTION_JOB_STATUSES[number];
export type ProductionTaskCategory = typeof PRODUCTION_TASK_CATEGORIES[number];
export type ProductionTaskStatus = typeof PRODUCTION_TASK_STATUSES[number];
export type DeliveryRecordStatus = typeof DELIVERY_RECORD_STATUSES[number];
export type DeliveryPacketStatus = typeof DELIVERY_PACKET_STATUSES[number];
export type PostDeliveryFollowUpStatus = typeof POST_DELIVERY_FOLLOW_UP_STATUSES[number];
export type PostDeliveryFollowUpType = typeof POST_DELIVERY_FOLLOW_UP_TYPES[number];
export type ActivityType = typeof ACTIVITY_TYPES[number];
export type InteractionType   = typeof INTERACTION_TYPES[number];
export type InteractionDirection = typeof INTERACTION_DIRECTIONS[number];
export type InteractionStatus   = typeof INTERACTION_STATUS[number];
export type InteractionOutcome  = typeof INTERACTION_OUTCOMES[number];
export type AttachmentType      = typeof ATTACHMENT_TYPES[number];
export type AccountPlanStatus   = typeof ACCOUNT_PLAN_STATUSES[number];

export {
  HUB_LABELS,
  dealStatusForDisplay, leadStatusForDisplay, entityForDisplay, roleForDisplay, unitStatusForDisplay, buildStatusForDisplay,
  deliveryRecordStatusForDisplay,
  DEAL_STATUS_DISPLAY, LEAD_STATUS_DISPLAY, UNIT_STATUS_DISPLAY, BUILD_STATUS_DISPLAY,
  DELIVERY_RECORD_STATUS_DISPLAY, ROLE_DISPLAY,
} from './uiLabels.js';

/**
 * Build the tenant ID from an entity + location.
 * 'HUB' + 'Wichita' → 'hub-wichita'
 */
export function buildTenantId(entity: Entity, location: Location): string {
  return `${entity.toLowerCase()}-${location.toLowerCase().replace(/\s+/g, '-')}`;
}

/** Coerce legacy imported entity codes to the active venue entity. */
export function normalizeEntity(entity: string | undefined): Entity {
  return DEFAULT_ENTITY;
}

/** Coerce legacy location values to the active venue city. */
export function normalizeLocation(location: string | undefined): Location {
  return DEFAULT_LOCATION;
}

/** User-facing label for stored tenant slugs (legacy slugs map to the same venue). */
export function tenantForDisplay(tenantId: string): string {
  return VENUE_FULL_LABEL;
}
