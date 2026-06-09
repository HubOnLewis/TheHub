// packages/shared/src/schemas/index.ts
import { z } from 'zod';
import {
  ENTITIES, LOCATIONS, ROLES, LEAD_STATUSES, DEAL_STATUSES, UNIT_STATUSES, ACTIVITY_TYPES,
  INTERACTION_TYPES, INTERACTION_DIRECTIONS, INTERACTION_STATUS, INTERACTION_OUTCOMES,
  ACCOUNT_PLAN_STATUSES, BUILD_STATUSES, BUILD_SPEC_ITEM_CATEGORIES, BUILD_COST_SOURCES, BUILD_PRICING_SOURCES, CHANGE_ORDER_STATUSES,   PRODUCTION_JOB_STATUSES, PRODUCTION_TASK_CATEGORIES, PRODUCTION_TASK_STATUSES, DELIVERY_RECORD_STATUSES,
  DELIVERY_PACKET_STATUSES, POST_DELIVERY_FOLLOW_UP_STATUSES, POST_DELIVERY_FOLLOW_UP_TYPES,
} from '../constants/index.js';

// ── Pagination ────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  data:  T[];
  total: number;
  page:  number;
  pages: number;
  limit: number;
}

// ── Lead ──────────────────────────────────────────────────────────
export const CreateLeadSchema = z.object({
  company:    z.string().min(1, 'Account / company name required'),
  contact:    z.string().min(1, 'Contact name required'),
  email:      z.string().email().optional().or(z.literal('')),
  phone:      z.string().optional(),
  source:     z.string().optional(),
  notes:      z.string().optional(),
  assignedTo: z.string().optional(),
  status:     z.enum(LEAD_STATUSES).default('New'),
});
export type CreateLeadPayload = z.infer<typeof CreateLeadSchema>;

// ── Deal ──────────────────────────────────────────────────────────
export const CreateDealSchema = z.object({
  title:      z.string().min(1, 'Opportunity title required'),
  companyId:  z.string().min(1).optional(),
  company:    z.string().min(1, 'Account required'),
  contact:    z.string().min(1, 'Contact required'),
  amount:     z.number().min(0).default(0),
  assignedTo: z.string().optional(),
  ownerUserId: z.string().optional(),
  leadId:     z.string().optional(),
  unitId:     z.string().optional(),
  unitIds:    z.array(z.string().min(1)).optional(),
  primaryUnitId: z.string().optional(),
  notes:      z.string().optional(),
  atRisk: z.object({
    flagged: z.boolean(),
    reason: z.string().optional(),
    flaggedAt: z.string().datetime({ offset: true }).optional(),
    flaggedByUserId: z.string().optional(),
    flaggedByName: z.string().optional(),
  }).optional(),
  managementReview: z.object({
    reviewedAt: z.string().datetime({ offset: true }).optional(),
    reviewedByUserId: z.string().optional(),
    reviewedByName: z.string().optional(),
    status: z.enum(['approved', 'challenged', 'watch']).optional(),
    notes: z.string().optional(),
  }).optional(),
  status:     z.enum(DEAL_STATUSES).default('Draft'),
});
export type CreateDealPayload = z.infer<typeof CreateDealSchema>;

// ── Unit ──────────────────────────────────────────────────────────
export const CreateUnitSchema = z.object({
  companyId:   z.string().min(1, 'Account required'),
  /** Legacy field name; UI labels as external reference. When set, remains 17 chars for DB compatibility. */
  vin:         z.string().length(17, 'Use 17 characters or leave blank').optional().or(z.literal('')),
  stockNumber: z.string().optional(),
  year:        z.number().int().min(1990).max(new Date().getFullYear() + 2).optional(),
  make:        z.string().min(1, 'Make required'),
  model:       z.string().min(1, 'Model required'),
  color:       z.string().optional(),
  spec:        z.string().optional(),
  notes:       z.string().optional(),
  msrp:        z.number().optional(),
  entity:      z.enum(ENTITIES),
  location:    z.enum(LOCATIONS),
  assignedDealId: z.string().optional(),
  status:      z.enum(UNIT_STATUSES).default('prospect'),
});
export type CreateUnitPayload = z.infer<typeof CreateUnitSchema>;

export const BuildSpecItemSchema = z.object({
  id: z.string().optional(),
  buildId: z.string().optional(),
  category: z.enum(BUILD_SPEC_ITEM_CATEGORIES),
  description: z.string().min(1),
  quantity: z.number().min(1).default(1),
  partNumber: z.string().optional(),
  vendorName: z.string().optional(),
  unitCostEstimate: z.number().min(0).optional(),
  unitSellPrice: z.number().min(0).optional(),
  extendedCostEstimate: z.number().min(0).optional(),
  extendedSellPrice: z.number().min(0).optional(),
  costSource: z.enum(BUILD_COST_SOURCES).optional(),
  pricingSource: z.enum(BUILD_PRICING_SOURCES).optional(),
  isStandard: z.boolean().default(false),
  notes: z.string().optional(),
  substitution: z.object({
    originalPartNumber: z.string().optional(),
    originalDescription: z.string().optional(),
    replacementPartNumber: z.string().optional(),
    replacementDescription: z.string().optional(),
    reason: z.string().optional(),
    changedAt: z.string().datetime({ offset: true }).optional(),
    changedByUserId: z.string().optional(),
    changedByName: z.string().optional(),
  }).optional(),
});

export const CreateBuildSchema = z.object({
  unitId: z.string().min(1, 'Unit required'),
  dealId: z.string().optional(),
  name: z.string().optional(),
  status: z.enum(BUILD_STATUSES).default('draft'),
  estimatedPrice: z.number().min(0).optional(),
  actualPrice: z.number().min(0).optional(),
  templateKey: z.string().optional(),
  templateName: z.string().optional(),
  isTemplateDerived: z.boolean().optional(),
  specItems: z.array(BuildSpecItemSchema).default([]),
});
export type CreateBuildPayload = z.infer<typeof CreateBuildSchema>;

export const PatchBuildSchema = z.object({
  dealId: z.string().optional(),
  name: z.string().optional(),
  status: z.enum(BUILD_STATUSES).optional(),
  estimatedPrice: z.number().min(0).optional(),
  actualPrice: z.number().min(0).optional(),
  templateKey: z.string().optional(),
  templateName: z.string().optional(),
  isTemplateDerived: z.boolean().optional(),
  specItems: z.array(BuildSpecItemSchema).optional(),
});
export type PatchBuildPayload = z.infer<typeof PatchBuildSchema>;

export const CreateBuildVersionSchema = z.object({
  reason: z.string().min(1).default('Spec update'),
  specItems: z.array(BuildSpecItemSchema).min(1),
});
export type CreateBuildVersionPayload = z.infer<typeof CreateBuildVersionSchema>;

export const CreateChangeOrderSchema = z.object({
  fromVersionId: z.string().min(1),
  toVersionId: z.string().min(1),
  reason: z.string().min(1),
  description: z.string().optional(),
});
export type CreateChangeOrderPayload = z.infer<typeof CreateChangeOrderSchema>;

export const PatchChangeOrderSchema = z.object({
  status: z.enum(CHANGE_ORDER_STATUSES).optional(),
  description: z.string().optional(),
  reason: z.string().min(1).optional(),
});
export type PatchChangeOrderPayload = z.infer<typeof PatchChangeOrderSchema>;

export const CreateProductionJobSchema = z.object({
  buildId: z.string().min(1),
  unitId: z.string().min(1),
  dealId: z.string().optional(),
  jobNumber: z.string().optional(),
  scheduledStartDate: z.string().datetime({ offset: true }).optional(),
  assignedTeam: z.string().optional(),
  notes: z.string().optional(),
});
export type CreateProductionJobPayload = z.infer<typeof CreateProductionJobSchema>;

export const PatchProductionJobSchema = z.object({
  status: z.enum(PRODUCTION_JOB_STATUSES).optional(),
  scheduledStartDate: z.string().datetime({ offset: true }).optional().nullable(),
  assignedTeam: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type PatchProductionJobPayload = z.infer<typeof PatchProductionJobSchema>;

export const CreateProductionTaskSchema = z.object({
  productionJobId: z.string().min(1),
  buildId: z.string().min(1),
  unitId: z.string().min(1),
  category: z.enum(PRODUCTION_TASK_CATEGORIES),
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(PRODUCTION_TASK_STATUSES).default('not_started'),
  sequence: z.number().int().min(1).optional(),
  assignedUserId: z.string().optional(),
  assignedUserName: z.string().optional(),
  assignedTeam: z.string().optional(),
  blockedReason: z.string().optional(),
  notes: z.string().optional(),
});
export type CreateProductionTaskPayload = z.infer<typeof CreateProductionTaskSchema>;

export const PatchProductionTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(PRODUCTION_TASK_STATUSES).optional(),
  sequence: z.number().int().min(1).optional().nullable(),
  assignedUserId: z.string().optional().nullable(),
  assignedUserName: z.string().optional().nullable(),
  assignedTeam: z.string().optional().nullable(),
  blockedReason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type PatchProductionTaskPayload = z.infer<typeof PatchProductionTaskSchema>;

export const DeliveryPunchItemSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  status: z.enum(['open', 'resolved']),
  notes: z.string().optional(),
});

export const CreateDeliveryRecordSchema = z.object({
  productionJobId: z.string().min(1),
  buildId: z.string().min(1),
  unitId: z.string().min(1),
  dealId: z.string().optional(),
  companyId: z.string().optional(),
  status: z.enum(DELIVERY_RECORD_STATUSES).default('pending'),
  scheduledDeliveryDate: z.string().datetime({ offset: true }).optional(),
  actualDeliveryDate: z.string().datetime({ offset: true }).optional(),
  deliveryContactName: z.string().optional(),
  deliveryNotes: z.string().optional(),
});
export type CreateDeliveryRecordPayload = z.infer<typeof CreateDeliveryRecordSchema>;

export const PatchDeliveryRecordSchema = z.object({
  status: z.enum(DELIVERY_RECORD_STATUSES).optional(),
  scheduledDeliveryDate: z.string().datetime({ offset: true }).optional().nullable(),
  actualDeliveryDate: z.string().datetime({ offset: true }).optional().nullable(),
  deliveryContactName: z.string().optional().nullable(),
  deliveryNotes: z.string().optional().nullable(),
});
export type PatchDeliveryRecordPayload = z.infer<typeof PatchDeliveryRecordSchema>;

export const CreateCloseoutChecklistSchema = z.object({
  productionJobId: z.string().min(1),
  deliveryRecordId: z.string().optional(),
  finalInspectionComplete: z.boolean().default(false),
  customerFacingDocsComplete: z.boolean().default(false),
  photosComplete: z.boolean().default(false),
  punchItemsResolved: z.boolean().default(false),
  notes: z.string().optional(),
  punchItems: z.array(DeliveryPunchItemSchema).default([]),
});
export type CreateCloseoutChecklistPayload = z.infer<typeof CreateCloseoutChecklistSchema>;

export const PatchCloseoutChecklistSchema = z.object({
  finalInspectionComplete: z.boolean().optional(),
  customerFacingDocsComplete: z.boolean().optional(),
  photosComplete: z.boolean().optional(),
  punchItemsResolved: z.boolean().optional(),
  notes: z.string().optional().nullable(),
  punchItems: z.array(DeliveryPunchItemSchema).optional(),
});
export type PatchCloseoutChecklistPayload = z.infer<typeof PatchCloseoutChecklistSchema>;

export const CreateDeliveryPacketSchema = z.object({
  deliveredVersionId: z.string().min(1).optional(),
  summary: z.string().optional(),
  deliveryNotes: z.string().optional(),
  includesPhotos: z.boolean().default(false),
  includesFinalSpecSummary: z.boolean().default(false),
  includesCustomerDocs: z.boolean().default(false),
  includesKeyContacts: z.boolean().default(false),
});
export type CreateDeliveryPacketPayload = z.infer<typeof CreateDeliveryPacketSchema>;

export const PatchDeliveryPacketSchema = z.object({
  status: z.enum(DELIVERY_PACKET_STATUSES).optional(),
  deliveredVersionId: z.string().min(1).optional().nullable(),
  summary: z.string().optional().nullable(),
  deliveryNotes: z.string().optional().nullable(),
  includesPhotos: z.boolean().optional(),
  includesFinalSpecSummary: z.boolean().optional(),
  includesCustomerDocs: z.boolean().optional(),
  includesKeyContacts: z.boolean().optional(),
});
export type PatchDeliveryPacketPayload = z.infer<typeof PatchDeliveryPacketSchema>;

export const CreatePostDeliveryFollowUpSchema = z.object({
  followUpType: z.enum(POST_DELIVERY_FOLLOW_UP_TYPES).default('check_in'),
  status: z.enum(POST_DELIVERY_FOLLOW_UP_STATUSES).default('pending'),
  dueAt: z.string().datetime({ offset: true }).optional(),
  ownerUserId: z.string().optional(),
  ownerName: z.string().optional(),
  notes: z.string().optional(),
});
export type CreatePostDeliveryFollowUpPayload = z.infer<typeof CreatePostDeliveryFollowUpSchema>;

export const PatchPostDeliveryFollowUpSchema = z.object({
  status: z.enum(POST_DELIVERY_FOLLOW_UP_STATUSES).optional(),
  dueAt: z.string().datetime({ offset: true }).optional().nullable(),
  completedAt: z.string().datetime({ offset: true }).optional().nullable(),
  ownerUserId: z.string().optional().nullable(),
  ownerName: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type PatchPostDeliveryFollowUpPayload = z.infer<typeof PatchPostDeliveryFollowUpSchema>;

// ── User ──────────────────────────────────────────────────────────
export const CreateUserSchema = z.object({
  name:     z.string().min(1, 'Name required'),
  email:    z.string().email('Valid email required'),
  password: z.string().min(8, 'Minimum 8 characters'),
  role:     z.enum(ROLES),
  entity:   z.enum(ENTITIES),
  location: z.enum(LOCATIONS),
});
export type CreateUserPayload = z.infer<typeof CreateUserSchema>;

// ── Company ───────────────────────────────────────────────────────
export const AddressSchema = z.object({
  street:     z.string().optional(),
  city:       z.string().optional(),
  state:      z.string().optional(),
  postalCode: z.string().optional(),
});

export const CreateCompanySchema = z.object({
  name:                 z.string().min(1, 'Company name required'),
  address:              AddressSchema.optional(),
  phone:                z.string().optional(),
  source:               z.string().min(1),
  sourceId:             z.string().min(1),
  daysSinceLastContact: z.number().int().min(0).optional(),
  importMeta:           z.record(z.unknown()).optional(),
});
export type CreateCompanyPayload = z.infer<typeof CreateCompanySchema>;

// ── Activity ──────────────────────────────────────────────────────
export const CreateActivitySchema = z.object({
  source:           z.string().min(1),
  sourceId:         z.string().min(1),
  companyId:        z.string().optional(),
  companyNameRaw:   z.string(),
  contactNameRaw:   z.string().optional(),
  activityTypeRaw:  z.string(),
  activityType:     z.enum(ACTIVITY_TYPES),
  createdByName:    z.string(),
  milesFromCompany: z.number().optional(),
  body:             z.string(),
  tags:             z.record(z.boolean()).optional(),
  importMeta:       z.record(z.unknown()).optional(),
});
export type CreateActivityPayload = z.infer<typeof CreateActivitySchema>;

// ── Interactions (POST /api/interactions) ───────────────────────
const aiInsightsSchema = z.object({
  suggestedFollowUp: z.string().datetime({ offset: true }).optional(),
  detectedIntent:    z.string().optional(),
  sentiment:         z.string().optional(),
  urgencyScore:      z.number().min(0).max(1).optional(),
  nextBestAction:    z.string().optional(),
}).optional();

export const CreateInteractionRequestSchema = z.object({
  companyId:     z.string().min(1, 'Company required'),
  type:            z.enum(INTERACTION_TYPES),
  direction:       z.enum(INTERACTION_DIRECTIONS),
  summary:         z.string().min(1, 'Summary required'),
  body:            z.string().min(1, 'Body required'),
  outcome:         z.enum(INTERACTION_OUTCOMES),
  status:          z.enum(INTERACTION_STATUS).default('open'),
  ownerUserId:     z.string().min(1).optional(),
  contactId:       z.string().min(1).optional(),
  relatedDealId:   z.string().min(1).optional(),
  unitId:          z.string().min(1).optional(),
  buildId:         z.string().min(1).optional(),
  parentInteractionId: z.string().min(1).optional(),
  followUpAt:      z
    .union([z.string().datetime({ offset: true }), z.literal('')])
    .optional()
    .transform(v => (v === undefined || v === '' ? undefined : v)),
  metadata:        z.record(z.unknown()).optional(),
  aiInsights:      aiInsightsSchema,
});
export type CreateInteractionRequestPayload = z.infer<typeof CreateInteractionRequestSchema>;

export const PatchInteractionRequestSchema = z.object({
  type:            z.enum(INTERACTION_TYPES).optional(),
  direction:       z.enum(INTERACTION_DIRECTIONS).optional(),
  summary:         z.string().min(1).optional(),
  body:            z.string().min(1).optional(),
  outcome:         z.enum(INTERACTION_OUTCOMES).optional(),
  status:          z.enum(INTERACTION_STATUS).optional(),
  ownerUserId:     z.string().min(1).optional().nullable(),
  contactId:       z.string().min(1).optional().nullable(),
  relatedDealId:   z.string().min(1).optional().nullable(),
  unitId:          z.string().min(1).optional().nullable(),
  buildId:         z.string().min(1).optional().nullable(),
  parentInteractionId: z.string().min(1).optional().nullable(),
  followUpAt:      z
    .union([z.string().datetime({ offset: true }), z.literal(''), z.null()])
    .optional()
    .transform(v => (v === undefined ? undefined : v === '' || v === null ? null : v)),
  metadata:        z.record(z.unknown()).optional(),
  aiInsights:      aiInsightsSchema,
});
export type PatchInteractionRequestPayload = z.infer<typeof PatchInteractionRequestSchema>;

// ── Account Planning ──────────────────────────────────────────────
export const CreateAccountPlanSchema = z.object({
  companyId: z.string().min(1, 'Company required'),
  companyName: z.string().optional(),
  ownerUserId: z.string().optional(),
  ownerName: z.string().optional(),
  status: z.enum(ACCOUNT_PLAN_STATUSES).default('draft'),
  objectives: z.array(z.string().min(1)).default([]),
  opportunities: z.array(z.string().min(1)).default([]),
  risks: z.array(z.string().min(1)).default([]),
  nextSteps: z.array(z.string().min(1)).default([]),
});
export type CreateAccountPlanPayload = z.infer<typeof CreateAccountPlanSchema>;

export const PatchAccountPlanSchema = z.object({
  companyId: z.string().min(1).optional(),
  companyName: z.string().optional(),
  ownerUserId: z.string().optional(),
  ownerName: z.string().optional(),
  status: z.enum(ACCOUNT_PLAN_STATUSES).optional(),
  objectives: z.array(z.string().min(1)).optional(),
  opportunities: z.array(z.string().min(1)).optional(),
  risks: z.array(z.string().min(1)).optional(),
  nextSteps: z.array(z.string().min(1)).optional(),
});
export type PatchAccountPlanPayload = z.infer<typeof PatchAccountPlanSchema>;
