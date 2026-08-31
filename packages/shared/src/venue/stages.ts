/**
 * Venue booking pipeline — user-facing stages.
 * Equipment-era DealStatus values remain in storage; map at the edges.
 */

import type { DealStatus } from '../constants/index.js';

/** Canonical venue pipeline (Perfect Venue mental model + Hub intelligence). */
export const VENUE_STAGES = [
  'inquiry',
  'qualified',
  'proposal',
  'deposit',
  'confirmed',
  'prep',
  'completed',
  'lost',
] as const;

export type VenueStage = (typeof VENUE_STAGES)[number];

export const VENUE_STAGE_LABELS: Record<VenueStage, string> = {
  inquiry: 'Inquiry',
  qualified: 'Qualified',
  proposal: 'Proposal sent',
  deposit: 'Deposit due',
  confirmed: 'Confirmed',
  prep: 'Event prep',
  completed: 'Completed',
  lost: 'Lost',
};

export const VENUE_STAGE_DESCRIPTIONS: Record<VenueStage, string> = {
  inquiry: 'New lead — capture details and respond quickly',
  qualified: 'Fit confirmed — ready to price and propose',
  proposal: 'Proposal out — follow up for decision and deposit',
  deposit: 'Deposit requested or partially paid',
  confirmed: 'Booked — deposit secured, date held',
  prep: 'Ops prep — BEO, staffing, access, final details',
  completed: 'Event complete — closeout and reviews',
  lost: 'Did not book',
};

/** Primary CTA for coordinators by stage */
export const VENUE_STAGE_PRIMARY_CTA: Record<VenueStage, string> = {
  inquiry: 'Qualify inquiry',
  qualified: 'Send proposal',
  proposal: 'Request deposit',
  deposit: 'Mark confirmed',
  confirmed: 'Start event prep',
  prep: 'Mark completed',
  completed: 'Review closeout',
  lost: 'Review record',
};

/** Map equipment DealStatus → venue stage (when no pvStatus / balance context). */
export const DEAL_STATUS_TO_VENUE_STAGE: Record<DealStatus, VenueStage> = {
  Draft: 'inquiry',
  'Pending Approval': 'qualified',
  Approved: 'proposal',
  Won: 'confirmed',
  'In Build': 'prep',
  Delivered: 'completed',
  Lost: 'lost',
};

/** Map venue stage → DealStatus for persistence */
export const VENUE_STAGE_TO_DEAL_STATUS: Record<VenueStage, DealStatus> = {
  inquiry: 'Draft',
  qualified: 'Pending Approval',
  proposal: 'Approved',
  deposit: 'Approved',
  confirmed: 'Won',
  prep: 'In Build',
  completed: 'Delivered',
  lost: 'Lost',
};

/** Perfect Venue–style status keys → venue stage */
export const PV_STATUS_TO_VENUE_STAGE: Record<string, VenueStage> = {
  lead: 'inquiry',
  qualified: 'qualified',
  proposal_sent: 'proposal',
  confirmed: 'confirmed',
  balance_due: 'deposit',
  completed: 'completed',
  lost: 'lost',
};

export function venueStageLabel(stage: VenueStage | string): string {
  if ((VENUE_STAGES as readonly string[]).includes(stage)) {
    return VENUE_STAGE_LABELS[stage as VenueStage];
  }
  return String(stage).replace(/_/g, ' ');
}

/**
 * Resolve display stage from CRM status, optional PV status, and money.
 */
export function resolveVenueStage(input: {
  dealStatus?: string | null;
  pvStatus?: string | null;
  balanceDue?: number | null;
  amountPaid?: number | null;
  grandTotal?: number | null;
}): VenueStage {
  const pv = input.pvStatus?.toLowerCase().replace(/\s+/g, '_');
  if (pv && PV_STATUS_TO_VENUE_STAGE[pv]) {
    let stage = PV_STATUS_TO_VENUE_STAGE[pv]!;
    // Refine confirmed + outstanding balance
    if (
      (stage === 'confirmed' || stage === 'prep') &&
      input.balanceDue != null &&
      input.balanceDue > 0
    ) {
      if ((input.amountPaid ?? 0) <= 0) stage = 'deposit';
    }
    return stage;
  }

  const ds = input.dealStatus as DealStatus | undefined;
  if (ds && DEAL_STATUS_TO_VENUE_STAGE[ds]) {
    let stage = DEAL_STATUS_TO_VENUE_STAGE[ds];
    if (stage === 'proposal' && (input.amountPaid ?? 0) > 0 && (input.balanceDue ?? 0) > 0) {
      return 'deposit';
    }
    if (stage === 'confirmed' && (input.balanceDue ?? 0) > 0 && (input.amountPaid ?? 0) <= 0) {
      return 'deposit';
    }
    return stage;
  }

  return 'inquiry';
}

/** Next deal status when advancing one venue step */
export function nextDealStatusForVenueAdvance(
  current: VenueStage,
): DealStatus | null {
  const order: VenueStage[] = [
    'inquiry',
    'qualified',
    'proposal',
    'deposit',
    'confirmed',
    'prep',
    'completed',
  ];
  const i = order.indexOf(current);
  if (i < 0 || i >= order.length - 1) return null;
  const next = order[i + 1]!;
  return VENUE_STAGE_TO_DEAL_STATUS[next];
}

export const VENUE_SPACES = [
  'Main Hall',
  'Gallery',
  'Patio',
  'Full venue',
  'Lobby',
  'TBD',
] as const;

export type VenueSpace = (typeof VENUE_SPACES)[number];

export const VENUE_EVENT_TYPES = [
  'Wedding',
  'Corporate',
  'Birthday',
  'Graduation',
  'Baby shower',
  'Fundraiser',
  'Private party',
  'Holiday party',
  'Meeting',
  'Other',
] as const;
