import type { PvEventStatus } from '../../data/perfectVenueSeed.js';

export interface NormalizedEvent {
  id: string;
  title: string;
  client: string;
  eventDate: string;
  eventType: string;
  pvStatus: PvEventStatus;
  value: number;
  depositPaid: number;
  balanceDue: number;
  guests: number;
  spaces: string[];
}

export interface NormalizedTask {
  id: string;
  title: string;
  client: string;
  linkedEvent: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  daysUntil: number;
  overdue: boolean;
  automationSource?: string;
}

export interface NormalizedInquiry {
  id: string;
  source: string;
  who: string;
  org: string;
  what: string;
  when: string;
  sla: string;
}

export interface IntelligenceDataContext {
  asOf: string;
  venueId: string;
  venueName: string;
  events: NormalizedEvent[];
  tasks: NormalizedTask[];
  inquiries: NormalizedInquiry[];
  activeEventCount: number;
  occupancyPct: number;
}
