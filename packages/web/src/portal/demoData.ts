import { PV_FLAGSHIP_DEAL } from '../data/perfectVenueSeed.js';
import { FULL_PV_EVENTS, FULL_PV_PROPOSALS } from '../data/perfectVenueFullExport.js';
import { getPaymentsForEvent } from '../data/pvFinancialIntelligence.js';
import { buildCanonicalFinancials, pickFlagshipEventId } from '../data/pvEventModel.js';
import type { PortalChecklistItem, PortalConciergeCard, PortalEventState, PortalMessage, PortalVendorSlot } from './types.js';

const FLAGSHIP_ID = pickFlagshipEventId() || 'pv-2474854';
const flagshipEvent = FULL_PV_EVENTS.find(e => e.id === FLAGSHIP_ID);
const flagshipProposal = FULL_PV_PROPOSALS[FLAGSHIP_ID];
const flagshipFin = flagshipEvent ? buildCanonicalFinancials(flagshipEvent) : null;

const displayDate =
  flagshipEvent?.eventDateIso && flagshipEvent.startTime && flagshipEvent.endTime
    ? `${flagshipEvent.dayLabel || 'Sun'}, ${flagshipEvent.eventDateIso} · ${flagshipEvent.startTime} – ${flagshipEvent.endTime}`
    : 'Saturday, June 7, 2026 · 3:00p – 7:00p';

const packageLines =
  flagshipProposal?.lines.map(l => ({
    code: l.menuSection.slice(0, 8),
    name: l.itemName,
    qty: `${l.quantity} ${l.unit}`,
    lineTotal: l.total,
    section: l.menuSection,
  })) ?? PV_FLAGSHIP_DEAL.selectedPackages.map(p => ({ ...p, section: 'Package' }));

const proposalTotal = flagshipFin?.proposalTotal ?? flagshipProposal?.total ?? PV_FLAGSHIP_DEAL.revenue;
const collectedTotal = flagshipFin?.collectedTotal ?? PV_FLAGSHIP_DEAL.collected;
const balanceDue = flagshipFin?.outstandingBalance ?? Math.max(0, proposalTotal - collectedTotal);

const paymentMilestones = [
  {
    label: 'Deposit',
    amount: flagshipFin?.depositPaid ?? PV_FLAGSHIP_DEAL.paymentMilestones[0]?.amount ?? 0,
    status: (flagshipFin?.hasDeposit ? 'paid' : 'due') as 'paid' | 'due' | 'upcoming',
    dueDate: flagshipEvent?.createdOn ?? undefined,
  },
  {
    label: 'Final balance',
    amount: balanceDue,
    status: (balanceDue <= 0 ? 'paid' : flagshipFin?.hasDeposit ? 'due' : 'upcoming') as 'paid' | 'due' | 'upcoming',
    dueDate: flagshipEvent?.eventDateIso ?? undefined,
  },
];

export const PORTAL_DEMO_EVENT = {
  ...PV_FLAGSHIP_DEAL,
  id: FLAGSHIP_ID,
  displayDate,
  venueName: 'HuB on Lewis',
  venueAddress: '1400 N Lewis St · Wichita, KS',
  coordinator: {
    name: flagshipEvent?.owner ?? 'Hannah Mitchell',
    email: 'coordinator@hubonlewis.com',
    phone: '(316) ***-****',
  },
  revenue: proposalTotal,
  collected: collectedTotal,
  packageTotal: proposalTotal,
  paidTotal: collectedTotal,
  proposalStatus: flagshipProposal?.primaryPackage ?? PV_FLAGSHIP_DEAL.proposalStatus,
  menuSections: flagshipProposal?.menuSections ?? ['Room Rental'],
  packageLines,
  readinessScore: flagshipEvent?.readinessScore ?? PV_FLAGSHIP_DEAL.aiClosePct,
  spacesBooked: flagshipEvent?.spaces?.length ? flagshipEvent.spaces : ['Event Space'],
  paymentMilestones,
  weatherWatch: '72°F · low rain chance · indoor backup available',
  accessInstructions: 'Load-in via east entrance · Kisi code sent 24h before event',
  heroImage: '/venue/hub-on-lewis/hero.jpg',
};

const SEED_CHECKLIST: PortalChecklistItem[] = PV_FLAGSHIP_DEAL.contractSteps.map((step, i) => ({
  id: `ck-pv-${i}`,
  label: step.label,
  due: step.detail,
  complete:
    step.label.toLowerCase().includes('deposit')
      ? !!flagshipFin?.hasDeposit
      : step.label.toLowerCase().includes('balance')
        ? balanceDue <= 0
        : step.complete,
  category: step.label.toLowerCase().includes('deposit') || step.label.toLowerCase().includes('balance')
    ? 'payments'
    : step.label.toLowerCase().includes('agreement') || step.label.toLowerCase().includes('proposal')
      ? 'documents'
      : 'logistics',
}));

const SEED_CONCIERGE: PortalConciergeCard[] = [
  {
    id: 'c-readiness',
    headline: PV_FLAGSHIP_DEAL.aiPlaybook.headline,
    because: `Perfect Venue · ${flagshipProposal?.primaryPackage ?? 'package'} · readiness ${PORTAL_DEMO_EVENT.readinessScore}%`,
    actionLabel: 'View checklist',
    actionRoute: '/portal/checklist',
  },
  ...PV_FLAGSHIP_DEAL.aiPlaybook.risks.slice(0, 2).map((risk, i) => ({
    id: `c-risk-${i}`,
    headline: risk,
    because: 'From your booking workflow · real export data',
    actionLabel: 'Open event workspace',
    actionRoute: `/portal/event/${FLAGSHIP_ID}`,
  })),
];

const SEED_MESSAGES: PortalMessage[] = PV_FLAGSHIP_DEAL.communications.map((c, i) => ({
  id: `m-pv-${i}`,
  from: c.actor.includes('Allen') ? PV_FLAGSHIP_DEAL.client : 'HuB team',
  role: c.channel === 'Portal' ? 'client' : 'coordinator',
  body: `${c.title} — ${c.channel} · ${c.at}`,
  at: c.at,
}));

const SEED_VENDORS: PortalVendorSlot[] = [
  { id: 'v-dj', type: 'DJ / music', name: 'Invite your DJ', status: 'placeholder' },
  { id: 'v-cat', type: 'Caterer', name: 'Family catering TBD', status: 'placeholder' },
  { id: 'v-photo', type: 'Photographer', name: 'Optional · add name', status: 'placeholder' },
];

export const PORTAL_PAYMENT_HISTORY = getPaymentsForEvent(FLAGSHIP_ID).map(p => ({
  id: p.id,
  label: p.paymentName || p.paymentType,
  amount: p.amount,
  paidOn: p.paidOnIso ?? '—',
  method: p.method || p.offlineMethod || '—',
  type: p.paymentType,
}));

export function createInitialPortalEventState(): PortalEventState {
  return {
    agreementStatus: flagshipEvent?.pvStatus === 'confirmed' ? 'signed' : 'viewed',
    agreementSignedAt: flagshipEvent?.confirmedOn ?? 'Apr 04, 2026',
    agreementViewedAt: flagshipEvent?.createdOn ?? 'Apr 02, 2026',
    guestCount: flagshipEvent?.guests ?? PORTAL_DEMO_EVENT.guestCount,
    guestEstimateLocked: false,
    layoutChoice: '',
    checklist: SEED_CHECKLIST.map(c => ({ ...c })),
    payments: paymentMilestones.map((m, i) => ({
      id: `pay-${i}`,
      label: m.label,
      amount: m.amount,
      status: m.status as PortalEventState['payments'][0]['status'],
      dueDate: 'dueDate' in m && m.dueDate ? String(m.dueDate) : undefined,
      paidAt: m.status === 'paid' ? (flagshipEvent?.confirmedOn ?? flagshipEvent?.createdOn ?? '—') : undefined,
    })),
    timeline: [
      ...PV_FLAGSHIP_DEAL.contractSteps.map((step, i) => ({
        id: `tl-pv-${i}`,
        at: step.detail,
        title: step.label,
        kind: step.label.toLowerCase().includes('deposit') ? ('payment' as const) : ('document' as const),
        detail: step.complete ? 'Complete' : 'Pending',
      })),
      ...PV_FLAGSHIP_DEAL.communications.slice(0, 2).map((c, i) => ({
        id: `tl-com-${i}`,
        at: c.at,
        title: c.title,
        kind: 'message' as const,
        detail: c.channel,
      })),
    ],
    messages: SEED_MESSAGES.map(m => ({ ...m })),
    vendors: SEED_VENDORS.map(v => ({ ...v })),
    conciergeCards: SEED_CONCIERGE.map(c => ({ ...c })),
  };
}
