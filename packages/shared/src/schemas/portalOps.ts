import { z } from 'zod';
import type { AppliedPlaybook } from '../venue/playbooks.js';
import type { ClientDetails } from '../venue/clientDetails.js';
import type { GuestPortalPayment } from '../venue/paymentSummary.js';
// ── Proposals (persisted, versioned, e-sign in portal) ────────────
export const PROPOSAL_STATUSES = [
  'draft',
  'sent',
  'viewed',
  'accepted',
  'declined',
  'superseded',
] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const CreateProposalSchema = z.object({
  eventId: z.string().min(1),
  eventTitle: z.string().optional(),
  title: z.string().min(1).optional(),
  summary: z.string().optional(),
  packageTotal: z.number().min(0).optional(),
  terms: z.string().optional(),
  space: z.string().optional(),
  eventDate: z.string().optional(),
  guests: z.number().int().min(0).optional(),
  send: z.boolean().optional(),
});
export type CreateProposalPayload = z.infer<typeof CreateProposalSchema>;

export const PatchProposalSchema = z.object({
  status: z.enum(PROPOSAL_STATUSES).optional(),
  title: z.string().min(1).optional(),
  summary: z.string().optional(),
  packageTotal: z.number().min(0).optional(),
  terms: z.string().optional(),
  send: z.boolean().optional(),
});
export type PatchProposalPayload = z.infer<typeof PatchProposalSchema>;

export const ProposalSignSchema = z.object({
  method: z.enum(['typed', 'drawn']),
  name: z.string().min(1).max(120),
  dataUrl: z.string().max(200_000).optional(),
});
export type ProposalSignPayload = z.infer<typeof ProposalSignSchema>;

export type ProposalRecord = {
  id: string;
  eventId: string;
  eventTitle: string;
  version: number;
  status: ProposalStatus;
  title: string;
  summary: string;
  packageTotal: number;
  terms: string;
  space?: string;
  eventDate?: string;
  guests?: number;
  token: string;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  viewedAt?: string;
  acceptedAt?: string;
  declinedAt?: string;
  acceptedBy?: string;
  createdBy?: string;
  supersedesId?: string;
  signature?: {
    method: 'typed' | 'drawn';
    name: string;
    dataUrl?: string;
    signedAt: string;
  };
};

// ── Communications (one in-app thread per event) ─────────────────
export const COMMS_CHANNELS = ['portal', 'email'] as const;
export const EMAIL_TEMPLATE_KEYS = ['inquiry', 'proposal', 'deposit', 'balance', 'thanks'] as const;

export const CreateOutboundMessageSchema = z.object({
  eventId: z.string().min(1),
  body: z.string().min(1).max(8000),
  subject: z.string().max(200).optional(),
  channel: z.enum(COMMS_CHANNELS).default('portal'),
  templateKey: z.enum(EMAIL_TEMPLATE_KEYS).optional(),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
  asDraft: z.boolean().optional(),
});
export type CreateOutboundMessagePayload = z.infer<typeof CreateOutboundMessageSchema>;

export const GuestPortalMessageSchema = z.object({
  body: z.string().min(1).max(4000),
});
export type GuestPortalMessagePayload = z.infer<typeof GuestPortalMessageSchema>;

export type GuestPortalMessage = {
  id: string;
  from: string;
  role: 'client' | 'coordinator';
  body: string;
  at: string;
  channel: 'portal' | 'email';
  deliveryStatus?: string;
};

export type GuestPortalProfile = {
  id: string;
  title: string;
  clientName: string;
  contactName: string;
  contactEmail: string | null;
  displayDate: string;
  eventStartIso: string | null;
  venueName: string;
  venueAddress: string;
  coordinator: { name: string; email: string; phone: string };
  packageTotal: number;
  paidTotal: number;
  balanceDue: number;
  guests: number;
  space: string;
  notes: string;
  source: 'crm' | 'demo';
};

export type GuestPortalDocument = {
  kind: 'proposal' | 'beo_guest' | 'beo_staff' | 'payment_summary';
  label: string;
  audience: 'guest' | 'staff' | 'manager';
  available: boolean;
};

export type GuestPortalNextDate = {
  label: string;
  date: string | null;
};


export const EVENT_TYPE_KEYS = ['wedding', 'corporate', 'social', 'nonprofit', 'private', 'other'] as const;

export const ApplyPlaybookSchema = z.object({
  eventType: z.enum(EVENT_TYPE_KEYS).optional(),
});
export type ApplyPlaybookPayload = z.infer<typeof ApplyPlaybookSchema>;

export const PatchPlaybookTaskSchema = z.object({
  taskId: z.string().min(1).max(80),
  status: z.enum(['open', 'done']),
});
export type PatchPlaybookTaskPayload = z.infer<typeof PatchPlaybookTaskSchema>;

export const PatchPlaybookDocumentSchema = z.object({
  key: z.string().min(1).max(80),
  onFile: z.boolean(),
});
export type PatchPlaybookDocumentPayload = z.infer<typeof PatchPlaybookDocumentSchema>;

export const PatchGuestTimelineStepSchema = z.object({
  stepId: z.string().min(1).max(80),
  status: z.enum(['open', 'done']),
});
export type PatchGuestTimelineStepPayload = z.infer<typeof PatchGuestTimelineStepSchema>;

export const GuestPortalDetailsSchema = z.object({
  guestCount: z.number().int().min(0).max(5000).optional(),
  layout: z.string().max(120).optional(),
  barPackage: z.string().max(40).optional(),
  allergies: z.string().max(2000).optional(),
  musicCutoff: z.string().max(80).optional(),
  timelineBlocks: z
    .array(
      z.object({
        id: z.string().max(80).optional(),
        label: z.string().min(1).max(120),
        startTime: z.string().max(40).optional().default(''),
        endTime: z.string().max(40).optional().default(''),
        notes: z.string().max(400).optional(),
      }),
    )
    .max(20)
    .optional(),
  vendors: z
    .array(
      z.object({
        id: z.string().max(80).optional(),
        type: z.string().max(80).optional().default(''),
        name: z.string().max(120).optional().default(''),
        status: z.enum(['invited', 'confirmed', 'placeholder']).optional().default('placeholder'),
      }),
    )
    .max(30)
    .optional(),
  contacts: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        email: z.union([z.string().email(), z.literal('')]).optional(),
        phone: z.string().max(40).optional(),
        role: z.enum(['client', 'planner', 'partner', 'other']).default('other'),
      }),
    )
    .max(8)
    .optional(),
});
export type GuestPortalDetailsPayload = z.infer<typeof GuestPortalDetailsSchema>;

export type GuestPortalSnapshot = {
  eventId: string;
  profile: GuestPortalProfile;
  proposal: ProposalRecord | null;
  payments: GuestPortalPayment[];
  messages: GuestPortalMessage[];
  timeline: Array<{
    key: string;
    label: string;
    state: 'complete' | 'current' | 'upcoming';
    detail?: string;
  }>;
  nextDates: GuestPortalNextDate[];
  documents: GuestPortalDocument[];
  clientDetails?: ClientDetails;
  playbook?: AppliedPlaybook | null;
};
