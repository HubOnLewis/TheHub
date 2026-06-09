/**
 * HuB on Lewis — Wichita event venue demo dataset for screenshots.
 * Pipeline, KPIs, calendar, inbox, and tasks are grounded in sanitized Perfect Venue export
 * (`perfectVenueSeed.ts`); blends with live API counts on dashboard where merged in UI.
 */

import {
  PV_DASHBOARD_KPIS,
  PV_DEMO_PIPELINE,
  PV_WEEK_EVENTS,
  PV_TASKS,
  PV_RECENT_INQUIRIES,
  PV_AI_ATTENTION,
  PV_OVERDUE_FOLLOWUPS,
  PV_INBOX_MESSAGES,
  PV_REVENUE_TREND_K,
  PV_OCCUPANCY_PCT,
  PV_BOOKING_TARGET,
  PV_FLAGSHIP_DEAL,
  getPvDemoCalendarMonth,
} from './perfectVenueSeed.js';

export type DemoPipelineStage = 'inquiry' | 'qualified' | 'proposal' | 'confirmed' | 'fulfillment' | 'closeout';

export interface DemoPipelineCard {
  id: string;
  title: string;
  client: string;
  eventDate: string;
  stage: DemoPipelineStage;
  value: number;
  depositPaid: number;
  balanceDue: number;
  spaces: string[];
  guests: number;
  accent: string;
  eventType: string;
}

export interface DemoWeekEvent {
  id: string;
  title: string;
  when: string;
  venue: string;
  status: string;
  chip?: string;
}

/** Task row badges — The Hub Autopilot workforce labeling */
export type TaskAutomationBadge =
  | 'auto-generated'
  | 'ai-suggested'
  | 'approval-required'
  | 'scheduled-sequence';

export interface DemoTask {
  id: string;
  title: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  linkedEvent: string;
  client: string;
  owner: { initials: string; name: string };
  dueAt: string;
  overdue: boolean;
  daysUntil: number;
  automationSource: string;
  automationBadge: TaskAutomationBadge;
}

export interface DemoCalendarDay {
  day: number;
  items: Array<{
    type: 'confirmed' | 'hold' | 'proposal' | 'site_visit' | 'payment' | 'closeout';
    label: string;
    time?: string;
  }>;
}

export interface DemoDealWorkspace {
  id: string;
  title: string;
  client: string;
  accountId: string;
  eventStart: string;
  eventEnd: string;
  guestCount: number;
  spacesBooked: string[];
  revenue: number;
  collected: number;
  proposalStatus: string;
  contractStatus: string;
  aiClosePct: number;
  aiUpsells: string[];
  nextAction: string;
  notesInternal: string;
  guestPreferences: string[];
  selectedPackages: Array<{ code: string; name: string; qty: string; lineTotal: number }>;
  paymentMilestones: Array<{ label: string; amount: number; status: 'paid' | 'scheduled' | 'due'; dueDate?: string }>;
  contractSteps: Array<{ label: string; complete: boolean; detail?: string }>;
  communications: Array<{ title: string; channel: string; actor: string; at: string }>;
  aiPlaybook: {
    headline: string;
    drivers: string[];
    risks: string[];
    suggestedCalls: string[];
  };
}

/** Operating brand — HuB on Lewis event campus */
export const DEMO_VENUE_NAME = 'HuB on Lewis';

export const DEMO_VENUE_TAGLINE = 'Lewis Street · Wichita';

/**
 * Venue imagery — drop files under `packages/web/public/venue/hub-on-lewis/` (see README there).
 * Paths are served by Vite as `/venue/hub-on-lewis/...` once assets exist; until then these act as labels + wiring for screenshots.
 */
export interface DemoVenueMediaSlot {
  id: string;
  label: string;
  /** Public URL path (static import when file present). */
  assetPath: string;
  /** Suggested dimensions / format for creative handoff */
  spec: string;
  role: 'exterior' | 'grand-hall' | 'kitchenette' | 'gallery' | 'terrace' | 'misc';
}

export const DEMO_VENUE_MEDIA_SLOTS: DemoVenueMediaSlot[] = [
  {
    id: 'exterior-hero',
    label: 'Exterior · arrival & signage',
    assetPath: '/venue/hub-on-lewis/exterior-hero.webp',
    spec: '2400×1350 · WebP hero',
    role: 'exterior',
  },
  {
    id: 'grand-hall-main',
    label: 'Grand Hall · main event floor',
    assetPath: '/venue/hub-on-lewis/grand-hall-main.webp',
    spec: '2400×1600 · WebP',
    role: 'grand-hall',
  },
  {
    id: 'kitchenette-prep',
    label: 'Kitchenette · catering prep',
    assetPath: '/venue/hub-on-lewis/kitchenette-prep.webp',
    spec: '1600×1200 · WebP',
    role: 'kitchenette',
  },
  {
    id: 'gallery-grid-a',
    label: 'Gallery · event collage A',
    assetPath: '/venue/hub-on-lewis/gallery-grid-a.webp',
    spec: '1200×1200 · WebP tile',
    role: 'gallery',
  },
  {
    id: 'gallery-grid-b',
    label: 'Gallery · event collage B',
    assetPath: '/venue/hub-on-lewis/gallery-grid-b.webp',
    spec: '1200×1200 · WebP tile',
    role: 'gallery',
  },
  {
    id: 'east-terrace-lewis',
    label: 'East terrace · Lewis Street',
    assetPath: '/venue/hub-on-lewis/east-terrace.webp',
    spec: '2000×1200 · WebP',
    role: 'terrace',
  },
];

/** Space cards for settings / proposals — HuB on Lewis scale */
export const DEMO_SPACE_SHOWCASE = [
  {
    space: 'Grand Hall',
    seated: 160,
    standing: 220,
    amenities: 'Stage north · house PA · rigging · green room adj.',
  },
  {
    space: 'River Room',
    seated: 72,
    standing: 100,
    amenities: 'Private bar · AV rack · breakout spill',
  },
  {
    space: 'Glass Atrium',
    seated: 56,
    standing: 85,
    amenities: 'Ceremony-first · natural light · modular staging',
  },
  {
    space: 'East Terrace',
    seated: 90,
    standing: 130,
    amenities: 'Tent-ready pad · power distro · weather backup noted on BEO',
  },
];

/** KPI seeds — Perfect Venue venuesEventsSummary (sanitized). */
export const DEMO_KPIS_SEED = PV_DASHBOARD_KPIS;

/** Last 7 periods (~$ thousands recognized) — sparkline */
export const DEMO_REVENUE_TREND_K = PV_REVENUE_TREND_K;

export const DEMO_OCCUPANCY_PCT = PV_OCCUPANCY_PCT;

export const DEMO_BOOKING_TARGET = PV_BOOKING_TARGET;

export const DEMO_RECENT_INQUIRIES = PV_RECENT_INQUIRIES;

export const DEMO_PIPELINE = PV_DEMO_PIPELINE;

export const DEMO_WEEK_EVENTS = PV_WEEK_EVENTS;

export const DEMO_OVERDUE_FOLLOWUPS = PV_OVERDUE_FOLLOWUPS;

export const DEMO_AI_ATTENTION = PV_AI_ATTENTION;

export const DEMO_TASKS = PV_TASKS;

/** May/June 2026 — Perfect Venue calendar export */
export function getDemoCalendarMonth(year: number, monthIndex0: number): DemoCalendarDay[] {
  return getPvDemoCalendarMonth(year, monthIndex0);
}

export const DEMO_DEAL_WORKSPACE: DemoDealWorkspace = PV_FLAGSHIP_DEAL;

export const DEMO_INBOX_MESSAGES = PV_INBOX_MESSAGES;

export function stageLabel(s: DemoPipelineStage): string {
  const m: Record<DemoPipelineStage, string> = {
    inquiry: 'New inquiry',
    qualified: 'Qualified',
    proposal: 'Proposal sent',
    confirmed: 'Confirmed event',
    fulfillment: 'Fulfillment',
    closeout: 'Closeout',
  };
  return m[s];
}
