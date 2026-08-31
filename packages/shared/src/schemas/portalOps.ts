import { z } from 'zod';
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

export type GuestPortalSnapshot = {
  eventId: string;
  profile: GuestPortalProfile;
  proposal: ProposalRecord | null;
  payments: Array<{
    id: string;
    eventId: string;
    kind: string;
    amount: number;
    status: string;
    dueDate?: string;
    paidAt?: string;
    createdAt: string;
  }>;
  messages: GuestPortalMessage[];
  timeline: Array<{
    key: string;
    label: string;
    state: 'complete' | 'current' | 'upcoming';
    detail?: string;
  }>;
  nextDates: GuestPortalNextDate[];
  documents: GuestPortalDocument[];
};
