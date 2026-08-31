/**
 * Live venue agent rules — runs on API and web against CRM events/leads.
 * No Perfect Venue seed. No LLM. LLM may summarize findings separately.
 */

import type { IntelligenceAgentId } from './types.js';
import { resolveVenueStage } from '../venue/stages.js';

export type LiveAgentEvent = {
  id: string;
  title: string;
  contact: string;
  status: string;
  pvStatus?: string | null;
  eventDateIso?: string | null;
  value: number;
  amountPaid: number;
  balanceDue: number;
  guests: number;
  space?: string | null;
  updatedAt?: string | null;
};

export type LiveAgentInquiry = {
  id: string;
  contact: string;
  company: string;
  status: string;
  updatedAt?: string | null;
  source?: string | null;
};

export type LiveAgentPriority = 'critical' | 'high' | 'medium' | 'low';

export type LiveAgentFinding = {
  id: string;
  agent: IntelligenceAgentId;
  agentLabel: string;
  priority: LiveAgentPriority;
  title: string;
  detail: string;
  entityId: string;
  entityKind: 'event' | 'lead';
  actionLabel: string;
  amount?: number;
  triggerRule: string;
};

export type LiveAgentEvaluation = {
  generatedAt: string;
  source: 'mongo';
  eventCount: number;
  inquiryCount: number;
  findings: LiveAgentFinding[];
  briefingHeadline: string;
  briefingSummary: string;
};

const AGENT_LABEL: Record<IntelligenceAgentId, string> = {
  'balance-guardian': 'Balance Guardian',
  'follow-up-hunter': 'Follow-Up Hunter',
  'booking-coordinator': 'Booking Coordinator',
  'calendar-conflict': 'Calendar Conflict',
  'owner-briefing': 'Owner Briefing',
  'revenue-lift': 'Revenue Lift',
  'review-referral': 'Review & Referral',
  'client-readiness': 'Client Readiness',
  'lead-concierge': 'Lead Concierge',
};

function daysUntil(iso: string | null | undefined, ref: Date): number | null {
  if (!iso) return null;
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - ref.getTime()) / 86_400_000);
}

function daysSince(iso: string | null | undefined, ref: Date): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((ref.getTime() - d.getTime()) / 86_400_000);
}

function money(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export function evaluateLiveVenueAgents(
  events: LiveAgentEvent[],
  inquiries: LiveAgentInquiry[],
  ref = new Date(),
): LiveAgentEvaluation {
  const findings: LiveAgentFinding[] = [];

  const bySpaceDate = new Map<string, LiveAgentEvent[]>();
  for (const e of events) {
    const stage = resolveVenueStage({
      dealStatus: e.status,
      pvStatus: e.pvStatus,
      balanceDue: e.balanceDue,
      amountPaid: e.amountPaid,
      grandTotal: e.value,
    });
    if (stage === 'lost' || stage === 'completed') continue;

    const day = e.eventDateIso?.slice(0, 10);
    if (day && e.space && e.space !== 'TBD') {
      const key = `${e.space}::${day}`;
      const list = bySpaceDate.get(key) ?? [];
      list.push(e);
      bySpaceDate.set(key, list);
    }

    const until = daysUntil(e.eventDateIso, ref);
    const idle = daysSince(e.updatedAt, ref);

    if (e.balanceDue > 0) {
      const urgent = until != null && until >= 0 && until <= 7;
      findings.push({
        id: `bal-${e.id}`,
        agent: 'balance-guardian',
        agentLabel: AGENT_LABEL['balance-guardian'],
        priority: urgent ? 'critical' : 'high',
        title: `Collect balance — ${money(e.balanceDue)}`,
        detail:
          until != null && until >= 0
            ? `${e.title} · event in ${until} day${until === 1 ? '' : 's'}`
            : `${e.title} · outstanding balance`,
        entityId: e.id,
        entityKind: 'event',
        actionLabel: 'Open money',
        amount: e.balanceDue,
        triggerRule: 'balanceDue>0',
      });
    }

    if (stage === 'proposal') {
      findings.push({
        id: `prop-${e.id}`,
        agent: 'follow-up-hunter',
        agentLabel: AGENT_LABEL['follow-up-hunter'],
        priority: idle != null && idle >= 3 ? 'high' : 'medium',
        title: 'Proposal follow-up',
        detail: `${e.title} · ${e.contact} · ${money(e.value)}`,
        entityId: e.id,
        entityKind: 'event',
        actionLabel: 'Draft follow-up',
        amount: e.value,
        triggerRule: 'venueStage==proposal',
      });
    }

    if (stage === 'inquiry' || stage === 'qualified') {
      findings.push({
        id: `inq-${e.id}`,
        agent: 'lead-concierge',
        agentLabel: AGENT_LABEL['lead-concierge'],
        priority: stage === 'inquiry' ? 'medium' : 'low',
        title: stage === 'inquiry' ? 'Inquiry needs qualification' : 'Qualified — send proposal',
        detail: `${e.title} · ${e.contact}`,
        entityId: e.id,
        entityKind: 'event',
        actionLabel: 'Open event',
        triggerRule: `venueStage==${stage}`,
      });
    }

    if (until != null && until >= 0 && until <= 3 && (stage === 'confirmed' || stage === 'prep')) {
      findings.push({
        id: `prep-${e.id}`,
        agent: 'booking-coordinator',
        agentLabel: AGENT_LABEL['booking-coordinator'],
        priority: until === 0 ? 'critical' : 'high',
        title: until === 0 ? 'Event is today — final prep' : `Event in ${until} days — prep check`,
        detail: `${e.title} · ${e.space || 'Space TBD'} · ${e.guests || '?'} guests`,
        entityId: e.id,
        entityKind: 'event',
        actionLabel: 'Open event',
        triggerRule: 'confirmed|prep && daysUntil<=3',
      });
    }

    if (e.amountPaid > 0 && e.balanceDue === 0 && until != null && until > 14 && e.value >= 2500) {
      findings.push({
        id: `upsell-${e.id}`,
        agent: 'revenue-lift',
        agentLabel: AGENT_LABEL['revenue-lift'],
        priority: 'low',
        title: 'Add-on window',
        detail: `${e.title} is paid and more than two weeks out — confirm extras.`,
        entityId: e.id,
        entityKind: 'event',
        actionLabel: 'Review extras',
        triggerRule: 'paidInFull && daysUntil>14 && value>=2500',
      });
    }

    if (!e.eventDateIso || e.guests <= 0) {
      findings.push({
        id: `ready-${e.id}`,
        agent: 'client-readiness',
        agentLabel: AGENT_LABEL['client-readiness'],
        priority: 'medium',
        title: 'Missing event details',
        detail: `${e.title} — capture ${!e.eventDateIso ? 'date' : 'guest count'}.`,
        entityId: e.id,
        entityKind: 'event',
        actionLabel: 'Edit details',
        triggerRule: '!eventDate || guests<=0',
      });
    }
  }

  for (const [, list] of bySpaceDate) {
    if (list.length < 2) continue;
    const [a, b] = list;
    if (!a || !b) continue;
    findings.push({
      id: `conf-${a.id}-${b.id}`,
      agent: 'calendar-conflict',
      agentLabel: AGENT_LABEL['calendar-conflict'],
      priority: 'critical',
      title: 'Possible space conflict',
      detail: `${a.title} and ${b.title} share ${a.space} on the same date. Confirm times.`,
      entityId: a.id,
      entityKind: 'event',
      actionLabel: 'Open calendar',
      triggerRule: 'same space + same date',
    });
  }

  for (const lead of inquiries) {
    if (['Converted', 'Lost'].includes(lead.status)) continue;
    const idle = daysSince(lead.updatedAt, ref) ?? 0;
    if (idle >= 3 || lead.status === 'New') {
      findings.push({
        id: `lead-${lead.id}`,
        agent: 'follow-up-hunter',
        agentLabel: AGENT_LABEL['follow-up-hunter'],
        priority: idle >= 5 ? 'high' : 'medium',
        title: idle >= 3 ? `Stale lead · ${lead.contact}` : `New lead · ${lead.contact}`,
        detail: `${lead.company} · ${lead.status}${lead.source ? ` · ${lead.source}` : ''} · ${idle}d since touch`,
        entityId: lead.id,
        entityKind: 'lead',
        actionLabel: 'Open lead',
        triggerRule: lead.status === 'New' ? 'lead.status==New' : 'lead.idle>=3d',
      });
    }
  }

  const rank: Record<LiveAgentPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  findings.sort((x, y) => rank[x.priority] - rank[y.priority]);
  const top = findings.slice(0, 60);

  const critical = top.filter(f => f.priority === 'critical').length;
  const balances = top.filter(f => f.agent === 'balance-guardian');
  const balanceSum = balances.reduce((s, f) => s + (f.amount ?? 0), 0);
  const activeEvents = events.filter(e => {
    const st = resolveVenueStage({
      dealStatus: e.status,
      pvStatus: e.pvStatus,
      balanceDue: e.balanceDue,
      amountPaid: e.amountPaid,
      grandTotal: e.value,
    });
    return st !== 'lost' && st !== 'completed';
  }).length;

  const briefingHeadline =
    critical > 0
      ? `${critical} critical item${critical === 1 ? '' : 's'} need attention`
      : balanceSum > 0
        ? `${money(balanceSum)} outstanding across the pipeline`
        : 'Pipeline is calm — keep follow-ups current';

  const briefingSummary = [
    `${activeEvents} active events`,
    `${inquiries.filter(i => !['Converted', 'Lost'].includes(i.status)).length} open leads`,
    `${top.length} agent findings`,
    balanceSum > 0 ? `${money(balanceSum)} balance due` : 'no flagged balances',
  ].join(' · ');

  return {
    generatedAt: ref.toISOString(),
    source: 'mongo',
    eventCount: events.length,
    inquiryCount: inquiries.length,
    findings: top,
    briefingHeadline,
    briefingSummary,
  };
}
