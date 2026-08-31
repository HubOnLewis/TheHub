/**
 * Guest-facing booking timeline — Inquiry → Day-of.
 * Staff venue stages stay in stages.ts; this is what the client portal shows.
 */

export const GUEST_TIMELINE_STAGES = [
  'inquiry',
  'proposal',
  'signed',
  'deposit',
  'details',
  'final_pay',
  'day_of',
] as const;

export type GuestTimelineStage = (typeof GUEST_TIMELINE_STAGES)[number];

export type GuestTimelineStepState = 'complete' | 'current' | 'upcoming';

export type GuestTimelineStep = {
  key: GuestTimelineStage;
  label: string;
  state: GuestTimelineStepState;
  detail?: string;
};

export const GUEST_TIMELINE_LABELS: Record<GuestTimelineStage, string> = {
  inquiry: 'Inquiry',
  proposal: 'Proposal',
  signed: 'Signed',
  deposit: 'Deposit',
  details: 'Details',
  final_pay: 'Final pay',
  day_of: 'Day-of',
};

export type GuestTimelineInput = {
  proposalStatus?: string | null;
  amountPaid?: number | null;
  balanceDue?: number | null;
  grandTotal?: number | null;
  eventDateIso?: string | null;
  /** Planning details confirmed AFTER deposit — not /book intake (guests+date+space). */
  detailsConfirmed?: boolean | null;
};

export type GuestPortalPhase =
  | 'awaiting_proposal'
  | 'awaiting_signature'
  | 'awaiting_deposit'
  | 'details'
  | 'final_pay'
  | 'day_of';

function money(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

function isDayOf(iso: string | null | undefined, now = new Date()): boolean {
  if (!iso) return false;
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return start.getTime() <= today.getTime();
}

export function guestHasPublishedProposal(status?: string | null): boolean {
  const proposal = (status ?? '').toLowerCase();
  return ['sent', 'viewed', 'accepted', 'declined', 'superseded'].includes(proposal);
}

export function guestProposalIsSigned(status?: string | null): boolean {
  return (status ?? '').toLowerCase() === 'accepted';
}

/**
 * Map portal store facts to a proposal status.
 * A pending_review agreement without a published proposal is still waiting — not "sent".
 */
export function proposalStatusFromPortal(input: {
  proposalStatus?: string | null;
  agreementStatus?: string | null;
}): string | null {
  const published = (input.proposalStatus ?? '').toLowerCase();
  if (published && published !== 'draft' && published !== 'none') return published;
  const agreement = (input.agreementStatus ?? '').toLowerCase();
  if (agreement === 'signed') return 'accepted';
  if (agreement === 'viewed') return 'viewed';
  return null;
}

/**
 * Derive the client portal status rail from the SAME proposal + money + event facts staff see.
 *
 * Day 0 after inquiry (no proposal, intake guests/date/space, $0):
 *   inquiry complete, current = proposal (waiting for venue to send).
 * Details is NOT complete from /book intake. Paid-in-full is never true on a $0 package.
 */
export function buildGuestStatusTimeline(
  input: GuestTimelineInput,
  now = new Date(),
): GuestTimelineStep[] {
  const proposal = (input.proposalStatus ?? '').toLowerCase();
  const paid = money(input.amountPaid);
  const balance = money(input.balanceDue);
  const total = money(input.grandTotal);
  const hasProposal = guestHasPublishedProposal(proposal);
  const signed = guestProposalIsSigned(proposal);
  const depositPaid = paid > 0;
  const paidInFull = total > 0 && balance <= 0 && paid >= total;
  // Intake (guests/date/space) is NOT planning confirmation.
  const details = Boolean(input.detailsConfirmed) && depositPaid;
  const dayOf = isDayOf(input.eventDateIso, now);

  const done: Record<GuestTimelineStage, boolean> = {
    inquiry: true,
    proposal: hasProposal || signed,
    signed,
    deposit: depositPaid,
    details,
    final_pay: paidInFull,
    day_of: dayOf,
  };

  let current: GuestTimelineStage = 'inquiry';
  for (const key of GUEST_TIMELINE_STAGES) {
    if (!done[key]) {
      current = key;
      break;
    }
    current = key;
  }
  if (done.day_of) current = 'day_of';

  const detailsByStage: Partial<Record<GuestTimelineStage, string>> = {
    inquiry: 'Received',
    proposal: signed
      ? 'Accepted'
      : proposal === 'viewed'
        ? 'Viewed — awaiting signature'
        : proposal === 'sent'
          ? 'Sent — awaiting review'
          : proposal === 'declined'
            ? 'Declined'
            : 'Not sent yet',
    signed: signed ? 'Agreement on file' : hasProposal ? 'Sign in the portal' : 'After your proposal arrives',
    deposit: depositPaid ? 'Deposit recorded' : signed ? 'Pay to hold your date' : 'After you sign',
    details: details
      ? 'Planning details confirmed'
      : depositPaid
        ? 'Guest count, layout, and timing'
        : 'After your deposit',
    final_pay: paidInFull ? 'Paid in full' : total > 0 && balance > 0 ? 'Balance remaining' : 'Schedule pending',
    day_of: dayOf ? 'Event date reached' : input.eventDateIso ?? 'Date TBD',
  };

  return GUEST_TIMELINE_STAGES.map(key => {
    let state: GuestTimelineStepState = 'upcoming';
    if (done[key] && key !== current) state = 'complete';
    else if (key === current) state = done[key] ? 'complete' : 'current';
    if (done.day_of && key === 'day_of') state = 'complete';
    return {
      key,
      label: GUEST_TIMELINE_LABELS[key],
      state,
      detail: detailsByStage[key],
    };
  });
}

export function guestPortalPhase(input: GuestTimelineInput, now = new Date()): GuestPortalPhase {
  const steps = buildGuestStatusTimeline(input, now);
  const current = steps.find(s => s.state === 'current') ?? steps.find(s => s.state === 'complete' && s.key === 'day_of');
  switch (current?.key) {
    case 'inquiry':
    case 'proposal':
      return 'awaiting_proposal';
    case 'signed':
      return 'awaiting_signature';
    case 'deposit':
      return 'awaiting_deposit';
    case 'details':
      return 'details';
    case 'final_pay':
      return 'final_pay';
    case 'day_of':
      return 'day_of';
    default:
      return 'awaiting_proposal';
  }
}

export type GuestNavItem = { to: 'home' | 'messages' | 'sign' | 'pay' | 'details' | 'docs'; label: string };

/** Stage-gated primary nav. Routes stay the same; only visibility changes. */
export function guestPrimaryNav(phase: GuestPortalPhase): GuestNavItem[] {
  const home: GuestNavItem = { to: 'home', label: 'Home' };
  const messages: GuestNavItem = { to: 'messages', label: 'Messages' };
  if (phase === 'awaiting_proposal') return [home, messages];
  if (phase === 'awaiting_signature') {
    return [home, { to: 'sign', label: 'Sign' }, messages];
  }
  if (phase === 'awaiting_deposit') {
    return [home, { to: 'pay', label: 'Pay deposit' }, messages];
  }
  return [home, { to: 'pay', label: 'Pay' }, { to: 'details', label: 'Details' }, messages];
}
