// packages/shared/src/schemas/index.ts
import { z } from 'zod';
import { ENTITIES, LOCATIONS, ROLES, LEAD_STATUSES, DEAL_STATUSES, UNIT_STATUSES, ACTIVITY_TYPES } from '../constants/index.js';

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
  company:    z.string().min(1, 'Company required'),
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
  title:      z.string().min(1, 'Deal title required'),
  company:    z.string().min(1, 'Company required'),
  contact:    z.string().min(1, 'Contact required'),
  amount:     z.number().min(0).default(0),
  assignedTo: z.string().optional(),
  leadId:     z.string().optional(),
  unitId:     z.string().optional(),
  notes:      z.string().optional(),
  status:     z.enum(DEAL_STATUSES).default('Draft'),
});
export type CreateDealPayload = z.infer<typeof CreateDealSchema>;

// ── Unit ──────────────────────────────────────────────────────────
export const CreateUnitSchema = z.object({
  vin:         z.string().length(17, 'VIN must be exactly 17 characters'),
  stockNumber: z.string().min(1, 'Stock number required'),
  year:        z.number().int().min(1990).max(new Date().getFullYear() + 2),
  make:        z.string().min(1, 'Make required'),
  model:       z.string().min(1, 'Model required'),
  color:       z.string().optional(),
  spec:        z.string().optional(),
  notes:       z.string().optional(),
  msrp:        z.number().optional(),
  entity:      z.enum(ENTITIES),
  location:    z.enum(LOCATIONS),
  status:      z.enum(UNIT_STATUSES).default('Available'),
});
export type CreateUnitPayload = z.infer<typeof CreateUnitSchema>;

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
