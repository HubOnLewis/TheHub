/**
 * Contextual embedded agent intelligence — surfaces outside Autopilot page.
 */

import type { AgentId } from '../agents/types.js';

export interface EmbeddedInsight {
  agentId: AgentId;
  agentName: string;
  message: string;
  tone?: 'info' | 'warn' | 'action';
}

export const DASHBOARD_AGENT_WATCH = {
  activeCount: 6,
  headline: '6 active agents monitoring venue operations',
  sub: 'Signals refresh from Perfect Venue seed + your approvals',
};

export const INBOX_INSIGHTS: EmbeddedInsight[] = [
  {
    agentId: 'lead-concierge',
    agentName: 'Lead Concierge',
    message: 'Suggests responding within 18m on qualified inquiries',
    tone: 'action',
  },
  {
    agentId: 'follow-up-hunter',
    agentName: 'Follow-Up Hunter',
    message: 'Miller/Harris thread cooling — proposal viewed, no deposit reply in 48h',
    tone: 'warn',
  },
];

export const DEAL_INSIGHTS: EmbeddedInsight[] = [
  {
    agentId: 'revenue-lift',
    agentName: 'Revenue Lift',
    message: 'AV / dessert station upsell opportunity if headcount firms above 30',
    tone: 'info',
  },
  {
    agentId: 'balance-guardian',
    agentName: 'Balance Guardian',
    message: 'Recommends final balance reminder cadence · due Jun 1',
    tone: 'warn',
  },
  {
    agentId: 'booking-coordinator',
    agentName: 'Booking Coordinator',
    message: 'Kisi access email queued — approve before Jun 7 load-in',
    tone: 'action',
  },
];

export const CALENDAR_INSIGHTS: EmbeddedInsight[] = [
  {
    agentId: 'calendar-conflict',
    agentName: 'Calendar Conflict',
    message: 'Tight load-in window Jun 6–7 — Dufferfest then Miller/Harris shower',
    tone: 'warn',
  },
];

export const TASKS_INSIGHTS: EmbeddedInsight[] = [
  {
    agentId: 'booking-coordinator',
    agentName: 'Booking Coordinator',
    message: 'Send Kisi Email tasks generated from confirmed events',
    tone: 'info',
  },
];

export const OWNER_BRIEFING_AGENT_SUMMARY = {
  risks: 3,
  headline: 'Owner Briefing Agent identified 3 operational risks for today',
};
