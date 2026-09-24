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
  qualified: 'Inquiry',
  proposal: 'Proposal',
  deposit: 'Deposit',
  confirmed: 'Booked',
  prep: 'Event day',
  completed: 'Complete',
  lost: 'Lost',
};

/** Staff-facing desk pipeline (maps onto internal VenueStage). */
export const DESK_PIPELINE_STEPS = [
  'inquiry',
  'proposal',
  'deposit',
  'booked',
  'event_day',
  'complete',
] as const;

export type DeskPipelineStep = (typeof DESK_PIPELINE_STEPS)[number];

export const DESK_PIPELINE_LABELS: Record<DeskPipelineStep, string> = {
  inquiry: 'Inquiry',
  proposal: 'Proposal',
  deposit: 'Deposit',
  booked: 'Booked',
  event_day: 'Event day',
  complete: 'Complete',
};

export function deskStepFromVenueStage(stage: VenueStage): DeskPipelineStep | 'lost' {
  if (stage === 'lost') return 'lost';
  if (stage === 'inquiry' || stage === 'qualified') return 'inquiry';
  if (stage === 'proposal') return 'proposal';
  if (stage === 'deposit') return 'deposit';
  if (stage === 'confirmed') return 'booked';
  if (stage === 'prep') return 'event_day';
  if (stage === 'completed') return 'complete';
  return 'inquiry';
}

export const VENUE_STAGE_DESCRIPTIONS: Record<VenueStage, string> = {
  inquiry: 'New request — reply and hold the date',
  qualified: 'Fit confirmed — send the proposal',
  proposal: 'Proposal out — follow up for a deposit',
  deposit: 'Waiting on deposit',
  confirmed: 'Booked — deposit secured',
  prep: 'Event is coming up — finish the plan',
  completed: 'Event finished',
  lost: 'Did not book',
};

/** Primary CTA for coordinators by stage */
export const VENUE_STAGE_PRIMARY_CTA: Record<VenueStage, string> = {
  inquiry: 'Reply to inquiry',
  qualified: 'Send proposal',
  proposal: 'Ask for deposit',
  deposit: 'Mark as booked',
  confirmed: 'Open event plan',
  prep: 'Mark event done',
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
