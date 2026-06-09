/**
 * Sanitized HuB on Lewis demo seed — derived from local Perfect Venue export (May 2026).
 * No raw export JSON is imported at runtime. No emails, phones, or proposal URLs.
 *
 * Source: data/perfect-venue-export/ (gitignored) — re-run `npm run extract:perfect-venue` to refresh.
 */

import { HUB_PUBLIC_CONTACT_EMAIL } from '@hub-crm/shared';
import type { DemoPipelineStage, DemoPipelineCard, DemoTask, DemoWeekEvent, DemoCalendarDay } from './demoVenue.js';

/** Perfect Venue lifecycle statuses (venue system of record). */
export type PvEventStatus =
  | 'lead'
  | 'qualified'
  | 'proposal_sent'
  | 'confirmed'
  | 'balance_due'
  | 'completed'
  | 'lost';

export const PV_STATUS_LABELS: Record<PvEventStatus, string> = {
  lead: 'Lead',
  qualified: 'Qualified',
  proposal_sent: 'Proposal Sent',
  confirmed: 'Confirmed',
  balance_due: 'Balance Due',
  completed: 'Completed',
  lost: 'Lost / Archived',
};

export function mapPvStatusToHubStage(status: PvEventStatus): DemoPipelineStage {
  switch (status) {
    case 'lead':
      return 'inquiry';
    case 'qualified':
      return 'qualified';
    case 'proposal_sent':
      return 'proposal';
    case 'confirmed':
    case 'balance_due':
      return 'confirmed';
    case 'completed':
      return 'closeout';
    case 'lost':
      return 'proposal';
    default:
      return 'qualified';
  }
}

export function pvStatusDisplay(status: PvEventStatus): string {
  return PV_STATUS_LABELS[status] ?? status;
}

/** Normalize PV amounts — export GraphQL stores currency in cents. */
export function pvCentsToDollars(cents: number): number {
  if (!Number.isFinite(cents)) return 0;
  return Math.round(cents) / 100;
}

/** Live venue summary — legacy GraphQL extract when full XLSX unavailable. */
export const PV_VENUE_SUMMARY_LEGACY = {
  activeEvents: 115,
  activePipelineDollars: 37_948,
  lead: 4,
  leadDollars: 0,
  qualified: 20,
  qualifiedDollars: 0,
  proposalSent: 35,
  proposalSentDollars: 19_738,
  confirmed: 56,
  confirmedDollars: 18_210,
  balanceDue: 0,
  balanceDueDollars: 0,
  completedYtd: 28,
  completedYtdDollars: 6_733,
  extractedAt: '2026-05-20',
  venue: 'HuB on Lewis',
};

export interface PvDashboardKpis {
  activeBookings: number;
  newLeads: number;
  qualifiedOpportunities: number;
  proposalSent: number;
  confirmedEvents: number;
  outstandingBalances: number;
  completedYtd: number;
  monthlyRevenue: number;
  aiForecastConfidence: number;
}

/** Dashboard KPI strip — legacy; resolved below when full export present. */
export const PV_DASHBOARD_KPIS_LEGACY: PvDashboardKpis = {
  activeBookings: PV_VENUE_SUMMARY_LEGACY.activeEvents,
  newLeads: PV_VENUE_SUMMARY_LEGACY.lead,
  qualifiedOpportunities: PV_VENUE_SUMMARY_LEGACY.qualified,
  proposalSent: PV_VENUE_SUMMARY_LEGACY.proposalSent,
  confirmedEvents: PV_VENUE_SUMMARY_LEGACY.confirmed,
  outstandingBalances: PV_VENUE_SUMMARY_LEGACY.balanceDueDollars,
  completedYtd: PV_VENUE_SUMMARY_LEGACY.completedYtd,
  monthlyRevenue: PV_VENUE_SUMMARY_LEGACY.confirmedDollars,
  aiForecastConfidence: 82,
};

export const PV_REVENUE_TREND_K = [11, 14, 16, 17, 19, 22, 38];
export const PV_BOOKING_TARGET = {
  label: 'May confirmed events',
  current: 12,
  goal: 18,
};

export interface PvSeedEvent {
  id: string;
  title: string;
  client: string;
  pvStatus: PvEventStatus;
  eventDate: string;
  eventTime?: string;
  guests: number;
  value: number;
  depositPaid: number;
  balanceDue: number;
  spaces: string[];
  eventType: string;
  accent: string;
}

function accentForStatus(s: PvEventStatus): string {
  switch (s) {
    case 'confirmed':
    case 'balance_due':
    case 'completed':
      return 'emerald';
    case 'proposal_sent':
      return 'violet';
    case 'qualified':
      return 'cyan';
    case 'lead':
      return 'amber';
    case 'lost':
      return 'rose';
    default:
      return 'emerald';
  }
}

/** Featured pipeline cards — legacy subset when full XLSX export unavailable. */
export const PV_PIPELINE_EVENTS_LEGACY: PvSeedEvent[] = [
  {
    id: 'pv-wedding-mia',
    title: 'Wedding',
    client: 'Mia Temple',
    pvStatus: 'proposal_sent',
    eventDate: '2027-10-23',
    eventTime: '8:00a – midnight',
    guests: 100,
    value: 975,
    depositPaid: 0,
    balanceDue: 975,
    spaces: ['Event Space'],
    eventType: 'Wedding',
    accent: 'violet',
  },
  {
    id: 'pv-vaughn',
    title: 'Vaughn Engagement',
    client: 'Ciara Trass',
    pvStatus: 'proposal_sent',
    eventDate: '2027-06-05',
    eventTime: '6:00p – 11:00p',
    guests: 50,
    value: 650,
    depositPaid: 325,
    balanceDue: 325,
    spaces: ['Event Space'],
    eventType: 'Engagement',
    accent: 'violet',
  },
  {
    id: 'pv-investor-lunch',
    title: 'Investor Lunch',
    client: 'Jason Lavender',
    pvStatus: 'confirmed',
    eventDate: '2026-05-20',
    eventTime: '11:30a – 2:00p',
    guests: 85,
    value: 400,
    depositPaid: 200,
    balanceDue: 200,
    spaces: ['Event Space'],
    eventType: 'Investor lunch · recurring',
    accent: 'emerald',
  },
  {
    id: 'pv-baby-1st',
    title: "Baby's 1st Birthday party",
    client: 'Samantha Thompson',
    pvStatus: 'qualified',
    eventDate: '2025-12-12',
    eventTime: '1:00p – 4:00p',
    guests: 90,
    value: 650,
    depositPaid: 0,
    balanceDue: 650,
    spaces: ['Event Space'],
    eventType: 'Birthday',
    accent: 'cyan',
  },
  {
    id: 'pv-wareia',
    title: 'WAREIA',
    client: 'Ely Randelas',
    pvStatus: 'confirmed',
    eventDate: '2026-06-11',
    eventTime: '5:30p – 9:30p',
    guests: 85,
    value: 400,
    depositPaid: 200,
    balanceDue: 200,
    spaces: ['Event Space'],
    eventType: 'Chapter meeting',
    accent: 'emerald',
  },
  {
    id: 'pv-wedding-reception',
    title: 'Wedding reception',
    client: 'Megan Deppner',
    pvStatus: 'qualified',
    eventDate: '2025-12-05',
    eventTime: '2:00p – midnight',
    guests: 95,
    value: 975,
    depositPaid: 0,
    balanceDue: 975,
    spaces: ['Event Space'],
    eventType: 'Wedding reception',
    accent: 'cyan',
  },
  {
    id: 'pv-dufferfest',
    title: 'Dufferfest',
    client: 'Jeff Morten',
    pvStatus: 'confirmed',
    eventDate: '2026-06-06',
    eventTime: '4:00p – 11:00p',
    guests: 75,
    value: 650,
    depositPaid: 325,
    balanceDue: 325,
    spaces: ['Event Space'],
    eventType: 'Golf outing',
    accent: 'emerald',
  },
  {
    id: 'pv-friendsgiving',
    title: 'Friendsgiving',
    client: 'Sherrie Lane',
    pvStatus: 'confirmed',
    eventDate: '2025-11-14',
    eventTime: '5:00p – 11:00p',
    guests: 72,
    value: 650,
    depositPaid: 325,
    balanceDue: 325,
    spaces: ['Event Space'],
    eventType: 'Friendsgiving',
    accent: 'emerald',
  },
  {
    id: 'pv-miller-harris',
    title: 'Miller/Harris Baby Shower',
    client: 'Kiasia Allen',
    pvStatus: 'confirmed',
    eventDate: '2026-06-07',
    eventTime: '3:00p – 7:00p',
    guests: 30,
    value: 450,
    depositPaid: 225,
    balanceDue: 225,
    spaces: ['Event Space'],
    eventType: 'Baby shower',
    accent: 'emerald',
  },
  {
    id: 'pv-villarreal',
    title: 'Villarreal Grad Party',
    client: 'Yovana Villarreal',
    pvStatus: 'confirmed',
    eventDate: '2026-06-13',
    eventTime: '4:00p – midnight',
    guests: 80,
    value: 650,
    depositPaid: 325,
    balanceDue: 325,
    spaces: ['Event Space'],
    eventType: 'Graduation party',
    accent: 'emerald',
  },
  {
    id: 'pv-michelle',
    title: 'Michelle Bradbury',
    client: 'Michelle Bradbury',
    pvStatus: 'confirmed',
    eventDate: '2026-06-28',
    eventTime: '12:00p – 5:00p',
    guests: 55,
    value: 650,
    depositPaid: 325,
    balanceDue: 325,
    spaces: ['Event Space'],
    eventType: 'Welcome home celebration',
    accent: 'emerald',
  },
  {
    id: 'pv-bingo',
    title: 'Bingo fundraiser / mental health awareness',
    client: 'Holly Hatten',
    pvStatus: 'confirmed',
    eventDate: '2026-05-15',
    eventTime: '4:00p – 8:00p',
    guests: 75,
    value: 650,
    depositPaid: 325,
    balanceDue: 325,
    spaces: ['Event Space'],
    eventType: 'Fundraiser',
    accent: 'emerald',
  },
  {
    id: 'pv-graduation-party',
    title: 'Graduation Party',
    client: 'Erica Barrios',
    pvStatus: 'lost',
    eventDate: '2026-05-16',
    eventTime: '5:00p – 11:00p',
    guests: 90,
    value: 550,
    depositPaid: 0,
    balanceDue: 550,
    spaces: ['Event Space'],
    eventType: 'Graduation',
    accent: 'rose',
  },
];

export function pvSeedToPipelineCard(e: PvSeedEvent): DemoPipelineCard {
  return {
    id: e.id,
    title: e.title,
    client: e.client,
    eventDate: e.eventDate,
    stage: mapPvStatusToHubStage(e.pvStatus),
    value: e.value,
    depositPaid: e.depositPaid,
    balanceDue: e.balanceDue,
    spaces: e.spaces,
    guests: e.guests,
    accent: e.accent,
    eventType: e.eventType,
  };
}

/** Operations week — legacy near-term highlights. */
export const PV_WEEK_EVENTS_LEGACY: DemoWeekEvent[] = [
  {
    id: 'pw1',
    title: 'ICT Investor Lunch · May session',
    when: 'Wed · 11:30a',
    venue: 'Event Space',
    status: 'Confirmed',
    chip: 'Recurring',
  },
  {
    id: 'pw2',
    title: 'WAREIA · June chapter night',
    when: 'Thu · 5:30p',
    venue: 'Event Space',
    status: 'Confirmed',
    chip: 'WAREIA',
  },
  {
    id: 'pw3',
    title: 'Dufferfest load-in',
    when: 'Sat Jun 6 · 3:00p',
    venue: 'Event Space',
    status: 'Production',
    chip: 'Golf',
  },
  {
    id: 'pw4',
    title: 'Miller/Harris baby shower',
    when: 'Sun Jun 7 · 3:00p',
    venue: 'Event Space',
    status: 'Confirmed',
    chip: 'Shower',
  },
  {
    id: 'pw5',
    title: 'Send Kisi access · Dufferfest',
    when: 'Due · in 10 days',
    venue: 'Tasks',
    status: 'Autopilot',
    chip: 'Kisi',
  },
];

export const PV_RECURRING = [
  {
    id: 'rec-investor',
    name: 'ICT Investor Lunch',
    cadence: 'Quarterly · third Wednesday',
    nextOccurrence: '2026-06-17',
    space: 'Event Space',
    typicalGuests: 85,
  },
  {
    id: 'rec-wareia',
    name: 'WAREIA',
    cadence: 'Every 2 months · Thursday evening',
    nextOccurrence: '2026-06-11',
    space: 'Event Space',
    typicalGuests: 85,
  },
] as const;

export const PV_TASKS: DemoTask[] = [
  {
    id: 'pv-t1',
    title: 'Send Kisi Email',
    priority: 'high',
    linkedEvent: 'Dufferfest',
    client: 'Jeff Morten',
    owner: { initials: 'JL', name: 'Jordan Lee' },
    dueAt: new Date(Date.now() + 10 * 86400000).toISOString(),
    overdue: false,
    daysUntil: 10,
    automationSource: 'Give Kisi access for allotted time and follow up with an email.',
    automationBadge: 'scheduled-sequence',
  },
  {
    id: 'pv-t2',
    title: 'Send Kisi Email',
    priority: 'high',
    linkedEvent: 'Miller/Harris Baby Shower',
    client: 'Kiasia Allen',
    owner: { initials: 'MK', name: 'Morgan Keesling' },
    dueAt: new Date(Date.now() + 11 * 86400000).toISOString(),
    overdue: false,
    daysUntil: 11,
    automationSource: 'Give Kisi access for allotted time and follow up with an email.',
    automationBadge: 'scheduled-sequence',
  },
  {
    id: 'pv-t3',
    title: 'Send Kisi Email',
    priority: 'medium',
    linkedEvent: 'WAREIA',
    client: 'Ely Randelas',
    owner: { initials: 'JL', name: 'Jordan Lee' },
    dueAt: new Date(Date.now() + 15 * 86400000).toISOString(),
    overdue: false,
    daysUntil: 15,
    automationSource: 'Give Kisi access for allotted time and follow up with an email.',
    automationBadge: 'scheduled-sequence',
  },
  {
    id: 'pv-t4',
    title: 'Send Kisi Email',
    priority: 'medium',
    linkedEvent: 'Investor Lunch',
    client: 'Jason Lavender',
    owner: { initials: 'AR', name: 'Alex Rivera' },
    dueAt: new Date(Date.now() + 21 * 86400000).toISOString(),
    overdue: false,
    daysUntil: 21,
    automationSource: 'Give Kisi access for allotted time and follow up with an email.',
    automationBadge: 'scheduled-sequence',
  },
  {
    id: 'pv-t5',
    title: 'Send Kisi Email',
    priority: 'medium',
    linkedEvent: 'Villarreal Grad Party',
    client: 'Yovana Villarreal',
    owner: { initials: 'MK', name: 'Morgan Keesling' },
    dueAt: new Date(Date.now() + 17 * 86400000).toISOString(),
    overdue: false,
    daysUntil: 17,
    automationSource: 'Give Kisi access for allotted time and follow up with an email.',
    automationBadge: 'scheduled-sequence',
  },
  {
    id: 'pv-t6',
    title: 'Send Kisi Email',
    priority: 'low',
    linkedEvent: 'Michelle Bradbury',
    client: 'Michelle Bradbury',
    owner: { initials: 'SO', name: 'Sam Okonkwo' },
    dueAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    overdue: false,
    daysUntil: 30,
    automationSource: 'Give Kisi access for allotted time and follow up with an email.',
    automationBadge: 'scheduled-sequence',
  },
];

export const PV_RECENT_INQUIRIES_LEGACY = [
  { id: 'pv-rq1', source: 'Web form', who: 'Samantha Thompson', org: "Baby's 1st Birthday", what: 'Qualified · Dec date hold', when: 'Recent', sla: 'Met' },
  { id: 'pv-rq2', source: 'Referral', who: 'Ciara Trass', org: 'Vaughn Engagement', what: 'Proposal sent · Jun 2027', when: '2 days ago', sla: '4h' },
  { id: 'pv-rq3', source: 'Phone', who: 'Megan Deppner', org: 'Wedding reception', what: 'Qualified · cocktail style', when: '3 days ago', sla: 'Met' },
  { id: 'pv-rq4', source: 'Inbox', who: 'Holly Hatten', org: 'Bingo fundraiser', what: 'Confirmed · May 15', when: 'Last week', sla: 'Met' },
];

export const PV_AI_ATTENTION_LEGACY = [
  {
    id: 'pv-a1',
    text: 'Dufferfest — Kisi access emails due before Jun 6 load-in; Autopilot queued for Jordan Lee approval.',
    severity: 'high' as const,
  },
  {
    id: 'pv-a2',
    text: 'WAREIA Jun 11 — deposit path still open on recurring chapter series; confirm Event Space flip window.',
    severity: 'high' as const,
  },
  {
    id: 'pv-a3',
    text: 'Miller/Harris shower Jun 7 — proposal viewed 6×; gentle deposit reminder drafted.',
    severity: 'medium' as const,
  },
  {
    id: 'pv-a4',
    text: 'Villarreal grad party Jun 13 — agreement signed; balance due at $325 after deposit.',
    severity: 'low' as const,
  },
];

export const PV_OVERDUE_FOLLOWUPS_LEGACY = [
  {
    id: 'pv-o1',
    what: 'Proposal follow-up · Vaughn Engagement',
    who: 'Morgan Keesling',
    due: 'May 19 · follow-up sent',
    amt: '$650 proposal · Ciara Trass',
  },
  {
    id: 'pv-o2',
    what: 'WAREIA June instance · deposit reminder',
    who: 'Jordan Lee',
    due: 'Jun 4 · scheduled',
    amt: 'Event Space · 85 guests',
  },
  {
    id: 'pv-o3',
    what: 'Michelle Bradbury · welcome-home details',
    who: 'Sam Okonkwo',
    due: 'Jun 20 · planning',
    amt: 'Tables & decor Q&A',
  },
];

type CalItemType = DemoCalendarDay['items'][number]['type'];

function calItem(status: PvEventStatus, label: string, time?: string): DemoCalendarDay['items'][number] {
  const type: CalItemType =
    status === 'confirmed' || status === 'balance_due'
      ? 'confirmed'
      : status === 'proposal_sent'
        ? 'proposal'
        : status === 'completed'
          ? 'closeout'
          : status === 'lost'
            ? 'hold'
            : 'site_visit';
  return { type, label, time };
}

/** May/June 2026 calendar highlights from PV GraphQL export. */
const PV_MAY_2026_DAYS: Record<number, DemoCalendarDay['items']> = {
  5: [calItem('confirmed', 'Investor series hold', '—')],
  7: [calItem('confirmed', 'Private event · Event Space', '6:00p')],
  8: [calItem('confirmed', 'Warner 1st Birthday', '3:00p')],
  12: [calItem('confirmed', 'Wichita AI Business Network', '11:45a')],
  14: [calItem('confirmed', 'WAREIA', '5:30p')],
  15: [calItem('confirmed', 'Bingo fundraiser', '4:00p')],
  20: [calItem('confirmed', 'ICT Investor Lunch', '11:30a')],
  22: [calItem('confirmed', 'Deal Soirée', '4:00p')],
  23: [calItem('confirmed', 'Gomez Grad Party', '4:00p')],
  29: [calItem('proposal_sent', 'Proposal hold', '—')],
  30: [calItem('confirmed', 'Large group event', '—')],
  31: [calItem('confirmed', 'Month-end event', '—')],
};

const PV_JUNE_2026_DAYS: Record<number, DemoCalendarDay['items']> = {
  6: [calItem('confirmed', 'Dufferfest', '4:00p')],
  7: [calItem('confirmed', 'Miller/Harris Baby Shower', '3:00p')],
  9: [calItem('confirmed', 'Wichita AI Business Network', '11:45a')],
  11: [calItem('confirmed', 'WAREIA', '5:30p')],
  13: [calItem('confirmed', 'Villarreal Grad Party', '4:00p')],
  17: [calItem('confirmed', 'ICT Investor Lunch', '11:30a')],
  28: [calItem('confirmed', 'Michelle Bradbury', '12:00p')],
};

export function getPvDemoCalendarMonthLegacy(year: number, monthIndex0: number): DemoCalendarDay[] {
  const daysInMonth = new Date(year, monthIndex0 + 1, 0).getDate();
  const rich =
    year === 2026 && monthIndex0 === 4
      ? PV_MAY_2026_DAYS
      : year === 2026 && monthIndex0 === 5
        ? PV_JUNE_2026_DAYS
        : null;
  const out: DemoCalendarDay[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const items = rich?.[d] ?? (d % 11 === 3 ? [{ type: 'site_visit' as const, label: 'Tour · sales', time: '—' }] : []);
    out.push({ day: d, items });
  }
  return out;
}

/** Sanitized inbox — category summaries only. */
export const PV_INBOX_MESSAGES = [
  {
    id: 'pv-i1',
    from: 'Finance · auto',
    org: '1st Anniversary Party',
    subject: 'Final balance reminder',
    preview: 'Remaining balance due prepared for client review — payment link in proposal (no raw thread).',
    unread: true,
    time: 'Today',
    channel: 'Email',
  },
  {
    id: 'pv-i2',
    from: 'HuB on Lewis',
    org: 'Miller/Harris Baby Shower',
    subject: 'Proposal follow-up',
    preview: 'Deposit and agreement steps outlined — client encouraged to secure Jun 7 date.',
    unread: true,
    time: '2d',
    channel: 'Email',
  },
  {
    id: 'pv-i3',
    from: 'HuB on Lewis',
    org: 'Graduation Party inquiry',
    subject: 'Initial inquiry response',
    preview: 'Venue amenities, capacity, and availability check sent — standard intake template.',
    unread: false,
    time: '3d',
    channel: 'Email',
  },
  {
    id: 'pv-i4',
    from: 'HuB on Lewis',
    org: 'Friendsgiving',
    subject: 'Signed agreement & deposit confirmation',
    preview: 'Client notified that agreement and deposit are complete — event confirmed on calendar.',
    unread: false,
    time: '1w',
    channel: 'Email',
  },
  {
    id: 'pv-i5',
    from: 'HuB on Lewis',
    org: 'Michelle Bradbury',
    subject: 'Tour / availability response',
    preview: 'Follow-up on layout questions and welcome-home celebration planning — tables and decor guidance.',
    unread: false,
    time: '2w',
    channel: 'Email',
  },
  {
    id: 'pv-i6',
    from: 'Holly Hatten',
    org: 'Bingo fundraiser',
    subject: 'Event coordination thank-you',
    preview: 'Brief thank-you for flexibility on nonprofit fundraiser logistics — proposal update noted.',
    unread: false,
    time: '1mo',
    channel: 'Email',
  },
];

/** Settings module labels from Perfect Venue (venue settings nav). */
export const PV_SETTINGS_MODULES = [
  'Venue Details',
  'Venue Profile',
  'Spaces',
  'Floor Plans',
  'Contact Form',
  'Integrations',
  'Express Book',
  'Menu',
  'Proposal',
  'Email',
  'Automated Tasks',
  'Taxes & Fees',
  'Team',
  'Billing',
  'Group Contact Form',
  'Group Settings',
  'Profile',
] as const;

/** Hub settings nav — PV parity + client review modules. */
export const PV_SETTINGS_NAV: { id: string; label: string }[] = [
  { id: 'review-notes', label: 'Review notes' },
  { id: 'data-import', label: 'Data Import' },
  { id: 'user-management', label: 'User management' },
  { id: 'autopilot', label: 'Autopilot & automations' },
  { id: 'venue-details', label: 'Venue Details' },
  { id: 'venue-profile', label: 'Venue Profile' },
  { id: 'spaces', label: 'Spaces' },
  { id: 'floor-plans', label: 'Floor Plans' },
  { id: 'contact-forms', label: 'Contact Form' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'express-book', label: 'Express Book' },
  { id: 'menu-packages', label: 'Menu' },
  { id: 'proposal-templates', label: 'Proposal' },
  { id: 'email-templates', label: 'Email' },
  { id: 'automated-tasks', label: 'Automated Tasks' },
  { id: 'taxes-fees', label: 'Taxes & Fees' },
  { id: 'team', label: 'Team' },
  { id: 'billing', label: 'Billing' },
  { id: 'group-contact-form', label: 'Group Contact Form' },
  { id: 'group-settings', label: 'Group Settings' },
  { id: 'profile', label: 'Profile' },
];

export const PV_VENUE_DETAILS_DEFAULTS = {
  legalName: 'HuB on Lewis LLC',
  dba: 'HuB on Lewis',
  street: '1400 N Lewis St',
  cityStateZip: 'Wichita, KS 67203',
  timeZone: 'America/Chicago',
  currency: 'US Dollar',
  eventTimeStart: '7:00am',
  eventTimeEnd: '12:00 midnight (next day)',
  defaultOwner: 'Jason Lavender',
  notificationEmail: HUB_PUBLIC_CONTACT_EMAIL,
};

export const PV_FLAGSHIP_DEAL_LEGACY = {
  id: 'pv-miller-harris',
  title: 'Miller/Harris Baby Shower',
  client: 'Kiasia Allen',
  accountId: 'acct_pv_miller_harris',
  eventStart: '2026-06-07T20:00:00.000Z',
  eventEnd: '2026-06-07T23:00:00.000Z',
  guestCount: 30,
  spacesBooked: ['Event Space'],
  revenue: 450,
  collected: 225,
  proposalStatus: 'Approved · shower package',
  contractStatus: 'Signed · deposit received',
  aiClosePct: 88,
  aiUpsells: ['Add dessert station (+$120)', 'Extended hour (+$95)'],
  nextAction: 'Confirm Kisi door code email before Jun 7 · 3:00p load-in.',
  notesInternal: 'PV export: deposit $225 of $450 collected. Shower workflow from Perfect Venue.',
  guestPreferences: ['Family-style shower · 30 guests expected'],
  selectedPackages: [
    { code: 'RM-SHOWER', name: 'Shower rental', qty: '1 event', lineTotal: 450 },
  ],
  paymentMilestones: [
    { label: 'Deposit (50%)', amount: 225, status: 'paid' as const },
    { label: 'Final balance', amount: 225, status: 'due' as const, dueDate: '2026-06-01' },
  ],
  contractSteps: [
    { label: 'Proposal issued', complete: true, detail: 'Apr 02' },
    { label: 'Agreement signed', complete: true, detail: 'Apr 12' },
    { label: 'Deposit received', complete: true, detail: 'Apr 12' },
    { label: 'Kisi access email', complete: false, detail: 'Autopilot task queued' },
  ],
  communications: [
    { title: 'Proposal follow-up sent', channel: 'Email', actor: 'HuB team → client', at: 'Apr 02 · 6:36p' },
    { title: 'Agreement & deposit steps', channel: 'Email', actor: 'Template · proposal', at: 'Apr 12' },
    { title: 'Client questions on layout', channel: 'Portal', actor: 'Kiasia Allen', at: 'Apr 18' },
  ],
  aiPlaybook: {
    headline: 'Strong booking — deposit on time; Kisi and day-of checklist remain.',
    drivers: ['Deposit received per PV workflow', 'Proposal opened multiple times', 'June weekend slot filling'],
    risks: ['Kisi email not yet sent (scheduled task)', 'Final balance due before event'],
    suggestedCalls: ['Quick confirm guest count 48h prior', 'Offer dessert station upsell if headcount grows'],
  },
};

/** Executive / Autopilot copy anchors — legacy subset. */
export const PV_EXECUTIVE_ANCHORS_LEGACY = {
  focusHeadline: 'June load-in week: Dufferfest, WAREIA, and Miller/Harris shower need Kisi + deposit paths clear.',
  overnightSamples: [
    'Queued Kisi reminder batch · Dufferfest & Miller/Harris',
    'Drafted WAREIA Jun 11 hold confirmation',
    'Flagged Villarreal grad party balance due Jun 1',
  ],
  revenueLeads: [
    { event: 'Villarreal Grad Party', note: '$325 balance after signed deposit', est: 325 },
    { event: 'Vaughn Engagement', note: 'Proposal sent · $650 package', est: 650 },
    { event: 'WAREIA series', note: 'Recurring chapter revenue · deposit cadence', est: 400 },
  ],
  staleProposals: [
    { title: 'Vaughn Engagement · Ciara Trass', days: 12, value: 650 },
    { title: "Baby's 1st Birthday · Samantha Thompson", days: 30, value: 650 },
    { title: 'Wedding reception · Megan Deppner', days: 60, value: 975 },
  ],
  balances: [
    { client: 'Villarreal Grad Party', event: 'Jun 13 · Yovana Villarreal', amount: 325, due: 'Jun 1' },
    { client: 'Vaughn Engagement', event: 'Jun 2027 hold', amount: 325, due: 'On sign' },
  ],
} as const;
