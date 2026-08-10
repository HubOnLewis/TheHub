/**
 * Map a live CRM deal (API or screenshot store) into portal display + interactive state.
 */

import type { PortalChecklistItem, PortalEventState, PortalPaymentMilestone, PortalUser } from './types.js';
import { createInitialPortalEventState, PORTAL_DEMO_EVENT } from './demoData.js';

export type PortalEventProfile = {
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

function money(n: unknown, fallback = 0): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
}

function formatDisplayDate(iso: string | null, start?: string | null, end?: string | null): string {
  if (!iso) return 'Date TBD';
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  if (start && end) return `${day} · ${start} – ${end}`;
  if (start) return `${day} · ${start}`;
  return day;
}

export function portalProfileFromDeal(deal: Record<string, unknown>): PortalEventProfile {
  const meta =
    deal.importMeta && typeof deal.importMeta === 'object'
      ? (deal.importMeta as Record<string, unknown>)
      : {};
  const id = String(deal._id ?? '');
  const grandTotal = money(meta.grandTotal, money(deal.amount));
  const amountPaid = money(meta.amountPaid, 0);
  const balanceDue =
    typeof meta.balanceDue === 'number'
      ? meta.balanceDue
      : Math.max(0, grandTotal - amountPaid);
  const eventDateIso =
    (typeof meta.eventDateIso === 'string' && meta.eventDateIso) ||
    (typeof meta.eventDate === 'string' && meta.eventDate) ||
    null;
  const startTime = typeof meta.startTime === 'string' ? meta.startTime : null;
  const endTime = typeof meta.endTime === 'string' ? meta.endTime : null;
  const guests = typeof meta.guests === 'number' ? meta.guests : 0;
  const space = typeof meta.space === 'string' ? meta.space : 'Event Space';
  const contactEmail =
    typeof meta.contactEmail === 'string'
      ? meta.contactEmail
      : typeof deal.email === 'string'
        ? deal.email
        : null;

  return {
    id,
    title: String(deal.title ?? 'Your event'),
    clientName: String(deal.company ?? 'Client'),
    contactName: String(deal.contact ?? 'Guest'),
    contactEmail,
    displayDate: formatDisplayDate(eventDateIso, startTime, endTime),
    eventStartIso: eventDateIso,
    venueName: 'HuB on Lewis',
    venueAddress: '1400 N Lewis St · Wichita, KS',
    coordinator: {
      name: String(deal.assignedTo ?? 'Hannah Bayless'),
      email: 'coordinator@hubonlewis.com',
      phone: '(316) ***-****',
    },
    packageTotal: grandTotal,
    paidTotal: amountPaid,
    balanceDue,
    guests,
    space,
    notes: typeof deal.notes === 'string' ? deal.notes : '',
    source: 'crm',
  };
}

export function portalStateFromProfile(profile: PortalEventProfile): PortalEventState {
  const base = createInitialPortalEventState();
  const deposit = Math.min(profile.paidTotal, profile.packageTotal);
  const remaining = Math.max(0, profile.packageTotal - profile.paidTotal);

  const payments: PortalPaymentMilestone[] = [
    {
      id: 'pay-deposit',
      label: 'Deposit',
      amount: deposit > 0 ? deposit : Math.round(profile.packageTotal * 0.25),
      status: profile.paidTotal > 0 ? 'paid' : 'due',
      paidAt: profile.paidTotal > 0 ? 'Recorded' : undefined,
    },
    {
      id: 'pay-balance',
      label: 'Final balance',
      amount: remaining > 0 ? remaining : Math.max(0, profile.packageTotal - deposit),
      status: remaining <= 0 ? 'paid' : profile.paidTotal > 0 ? 'due' : 'scheduled',
      dueDate: profile.eventStartIso ?? undefined,
    },
  ];

  const checklist: PortalChecklistItem[] = [
    {
      id: 'ck-details',
      label: 'Confirm event details',
      complete: Boolean(profile.eventStartIso && profile.guests > 0),
      category: 'logistics',
    },
    {
      id: 'ck-agreement',
      label: 'Review & sign agreement',
      complete: false,
      category: 'documents',
    },
    {
      id: 'ck-deposit',
      label: 'Deposit received',
      complete: profile.paidTotal > 0,
      category: 'payments',
    },
    {
      id: 'ck-guests',
      label: 'Confirm guest count',
      complete: profile.guests > 0,
      category: 'guests',
    },
    {
      id: 'ck-balance',
      label: 'Final balance settled',
      complete: remaining <= 0 && profile.packageTotal > 0,
      category: 'payments',
    },
  ];

  return {
    ...base,
    guestCount: profile.guests || base.guestCount,
    payments,
    checklist,
    timeline: [
      {
        id: `tl-open-${Date.now()}`,
        at: new Date().toLocaleString(),
        title: 'Client portal opened',
        detail: profile.title,
        kind: 'system',
      },
      ...base.timeline.slice(0, 4),
    ],
    messages: [
      {
        id: 'msg-welcome',
        from: profile.coordinator.name,
        role: 'coordinator',
        body: `Hi ${profile.contactName.split(' ')[0] || 'there'} — welcome to your HuB on Lewis event portal for ${profile.title}. Review your checklist, payments, and messages here anytime.`,
        at: 'Just now',
      },
    ],
    conciergeCards: [
      {
        id: 'c-welcome',
        headline: remaining > 0 ? `${formatMoney(remaining)} remaining on your package` : 'Package is paid in full',
        because: `${profile.space} · ${profile.guests || '—'} guests · ${profile.displayDate}`,
        actionLabel: 'View payments',
        actionRoute: '/portal/payments',
      },
      {
        id: 'c-checklist',
        headline: 'Complete your planning checklist',
        because: 'Keep your coordinator updated before the event date',
        actionLabel: 'Open checklist',
        actionRoute: '/portal/checklist',
      },
    ],
  };
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export function demoPortalProfile(): PortalEventProfile {
  const d = PORTAL_DEMO_EVENT as typeof PORTAL_DEMO_EVENT & {
    client?: string;
    eventStart?: string;
    guestCount?: number;
    notesInternal?: string;
    spacesBooked?: string[];
  };
  return {
    id: d.id,
    title: d.title,
    clientName: d.client ?? 'Client',
    contactName: d.client ?? 'Client',
    contactEmail: null,
    displayDate: d.displayDate,
    eventStartIso: d.eventStart ?? null,
    venueName: d.venueName,
    venueAddress: d.venueAddress,
    coordinator: d.coordinator,
    packageTotal: d.packageTotal,
    paidTotal: d.paidTotal,
    balanceDue: Math.max(0, d.packageTotal - d.paidTotal),
    guests: d.guestCount ?? 30,
    space: d.spacesBooked?.[0] ?? 'Event Space',
    notes: d.notesInternal ?? '',
    source: 'demo',
  };
}

export function portalUserFromProfile(profile: PortalEventProfile): PortalUser {
  return {
    id: `portal-${profile.id}`,
    name: profile.contactName,
    email: profile.contactEmail || `${profile.contactName.toLowerCase().replace(/\s+/g, '.')}@client.hub`,
    role: 'client',
    eventId: profile.id,
  };
}
