/**
 * Contextual agent dock copy — embedded staff intelligence per surface.
 */

import type { AgentId } from '../agents/types.js';

export type AgentDockContext =
  | 'dashboard'
  | 'owner-briefing'
  | 'deal'
  | 'calendar'
  | 'inbox'
  | 'tasks';

export type AgentDockRisk = 'low' | 'medium' | 'high';

export interface ContextAgentDockModel {
  watching: Array<{ agentId: AgentId; label: string }>;
  suggestedMove: string;
  whyItMatters: string;
  risk: AgentDockRisk;
  whatChanged: string;
  ownerAction: string;
}

export const CONTEXT_AGENT_DOCK: Record<AgentDockContext, ContextAgentDockModel> = {
  dashboard: {
    watching: [
      { agentId: 'owner-briefing', label: 'Owner Briefing' },
      { agentId: 'balance-guardian', label: 'Balance Guardian' },
      { agentId: 'calendar-conflict', label: 'Calendar Conflict' },
    ],
    suggestedMove: 'Clear 3 Autopilot approvals before ICT lunch load-in',
    whyItMatters: 'Two Event Space events today — turnover at 2:30p is the pressure point',
    risk: 'medium',
    whatChanged: 'Miller/Harris proposal viewed again · balance reminder drafted',
    ownerAction: 'Open Today mission control → approve Kisi batch',
  },
  'owner-briefing': {
    watching: [
      { agentId: 'owner-briefing', label: 'Owner Briefing Agent' },
      { agentId: 'revenue-lift', label: 'Revenue Lift' },
      { agentId: 'follow-up-hunter', label: 'Follow-Up Hunter' },
    ],
    suggestedMove: 'Protect Jun 6–7 turnover — staffing watch on Dufferfest → shower',
    whyItMatters: '$4.2k balances due this week · proposal momentum soft on 3 threads',
    risk: 'high',
    whatChanged: 'Overnight: 2 proposal views · 1 deposit path advanced',
    ownerAction: 'Review revenue leaks → delegate balance reminders to Hannah',
  },
  deal: {
    watching: [
      { agentId: 'follow-up-hunter', label: 'Follow-Up Hunter' },
      { agentId: 'balance-guardian', label: 'Balance Guardian' },
      { agentId: 'booking-coordinator', label: 'Booking Coordinator' },
    ],
    suggestedMove: 'Approve final balance reminder before Jun 7 load-in',
    whyItMatters: 'Confirmed shower · 50% collected · Kisi access queued',
    risk: 'medium',
    whatChanged: 'Guest count held at 30 · layout questions in portal',
    ownerAction: 'Queue client draft or mark next action complete',
  },
  calendar: {
    watching: [
      { agentId: 'calendar-conflict', label: 'Calendar Conflict' },
      { agentId: 'booking-coordinator', label: 'Booking Coordinator' },
    ],
    suggestedMove: 'Hold River Room AM gap Tue — pitch WAREIA repeat',
    whyItMatters: 'May stress index elevated Wed · double Event Space tonight',
    risk: 'high',
    whatChanged: 'Jun 6–7 turnover conflict flagged in load strip',
    ownerAction: 'Review staffing watch on calendar intelligence rail',
  },
  inbox: {
    watching: [
      { agentId: 'lead-concierge', label: 'Lead Concierge' },
      { agentId: 'follow-up-hunter', label: 'Follow-Up Hunter' },
    ],
    suggestedMove: 'Respond to Miller/Harris thread within 18m window',
    whyItMatters: 'Cooling inquiry risks date slip — proposal viewed, no reply',
    risk: 'medium',
    whatChanged: 'AI draft available · approval required before send',
    ownerAction: 'Generate reply → queue for approval',
  },
  tasks: {
    watching: [
      { agentId: 'booking-coordinator', label: 'Booking Coordinator' },
    ],
    suggestedMove: 'Complete Send Kisi Email before 10:30a setup',
    whyItMatters: 'Autopilot-generated tasks tie to confirmed events today',
    risk: 'low',
    whatChanged: '2 urgent tasks · 0 overdue in local queue',
    ownerAction: 'Assign owner if Hannah is on floor walkthrough',
  },
};
