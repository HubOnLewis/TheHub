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
  detailsConfirmed?: boolean | null;
};

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

/**
 * Derive the client portal status rail from the SAME proposal + money + event facts staff see.
 */
export function buildGuestStatusTimeline(
  input: GuestTimelineInput,
  now = new Date(),
): GuestTimelineStep[] {
  const proposal = (input.proposalStatus ?? '').toLowerCase();
  const paid = money(input.amountPaid);
  const balance = money(input.balanceDue);
  const total = money(input.grandTotal);
  const hasProposal = ['sent', 'viewed', 'accepted', 'declined', 'superseded'].includes(proposal);
  const signed = proposal === 'accepted';
  const depositPaid = paid > 0;
  const paidInFull = total > 0 && balance <= 0 && paid >= total;
  const details = Boolean(input.detailsConfirmed);
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
    proposal: signed
      ? 'Accepted'
      : proposal === 'viewed'
        ? 'Viewed — awaiting signature'
        : proposal === 'sent'
          ? 'Sent — awaiting review'
          : proposal === 'declined'
            ? 'Declined'
            : 'Not sent yet',
    signed: signed ? 'Agreement on file' : 'Sign in the portal',
    deposit: depositPaid ? 'Deposit recorded' : 'Staff-recorded until Stripe',
    details: details ? 'Planning details confirmed' : 'Guest count, layout, and timing',
    final_pay: paidInFull ? 'Paid in full' : balance > 0 ? 'Balance remaining' : 'Schedule pending',
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
