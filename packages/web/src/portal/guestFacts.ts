import {
  buildGuestStatusTimeline,
  clientDetailsAreComplete,
  guestHasPublishedProposal,
  guestPortalPhase,
  guestPrimaryNav,
  proposalStatusFromPortal,
  type GuestTimelineInput,
} from '@hub-crm/shared';
import { PORTAL_ROUTES } from './paths.js';
import { usePortalStore } from './portalStore.js';

export function useGuestFacts() {
  const proposal = usePortalStore(s => s.proposal);
  const event = usePortalStore(s => s.event);
  const profile = usePortalStore(s => s.profile);
  const snapshot = usePortalStore(s => s.snapshot);

  const proposalStatus = proposalStatusFromPortal({
    proposalStatus: proposal?.status,
    agreementStatus: event.agreementStatus,
  });
  const input: GuestTimelineInput = {
    proposalStatus,
    amountPaid: profile.paidTotal,
    balanceDue: profile.balanceDue,
    grandTotal: profile.packageTotal,
    eventDateIso: profile.eventStartIso,
    detailsConfirmed: clientDetailsAreComplete(snapshot?.clientDetails),
  };
  const steps = buildGuestStatusTimeline(input);
  const phase = guestPortalPhase(input);
  const hasProposal = guestHasPublishedProposal(proposalStatus);
  const nav = guestPrimaryNav(phase);
  return { input, steps, phase, hasProposal, proposal, nav };
}

export function portalPathForNav(to: 'home' | 'messages' | 'sign' | 'pay' | 'details' | 'docs'): string {
  switch (to) {
    case 'home':
    case 'sign':
      return PORTAL_ROUTES.dashboard;
    case 'messages':
      return PORTAL_ROUTES.messages;
    case 'pay':
      return PORTAL_ROUTES.payments;
    case 'details':
      return PORTAL_ROUTES.details;
    case 'docs':
      return PORTAL_ROUTES.documents;
    default:
      return PORTAL_ROUTES.dashboard;
  }
}
