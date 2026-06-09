/**
 * Autopilot agent snapshot — powered by rules-first intelligence engine.
 * Legacy evaluate* retained for reference; runtime path uses intelligence bridge.
 */

import { runIntelligenceEngine, resetIntelligenceEngine } from '../intelligence/engine.js';
import { intelligenceToAgentSnapshot } from '../intelligence/bridge/toAgentSnapshot.js';
import {
  PV_PIPELINE_EVENTS,
  PV_TASKS,
  PV_VENUE_SUMMARY,
  PV_WEEK_EVENTS,
  PV_FLAGSHIP_DEAL,
  PV_AI_ATTENTION,
  PV_EXECUTIVE_ANCHORS,
} from '../data/perfectVenueSeed.js';
import { AGENT_BY_ID, AGENT_REGISTRY } from './registry.js';
import type {
  AgentActivity,
  AgentEngineSnapshot,
  AgentId,
  AgentProposedAction,
  AgentRecommendation,
  AgentRiskLevel,
  AgentRuntimeState,
  AgentSignal,
  AgentStatus,
  DealAutopilotRailView,
  OwnerBriefingInputs,
} from './types.js';

const AS_OF = '2026-05-20T12:00:00.000Z';

function agentName(id: AgentId): string {
  return AGENT_BY_ID[id].shortName;
}

function relTime(minutesAgo: number): string {
  if (minutesAgo < 60) return `${minutesAgo}m ago`;
  if (minutesAgo < 180) return `${Math.floor(minutesAgo / 60)}h ago`;
  return '7:05a';
}

function evaluateSignals(): AgentSignal[] {
  const signals: AgentSignal[] = [];

  for (const e of PV_PIPELINE_EVENTS) {
    if (e.balanceDue > 0 && e.pvStatus === 'confirmed') {
      signals.push({
        id: `sig-bal-${e.id}`,
        agentId: 'balance-guardian',
        type: 'balance_due',
        title: `Balance due · ${e.title}`,
        summary: `${e.client} — $${e.balanceDue} remaining after $${e.depositPaid} deposit.`,
        triggerData: `event.balanceDue=${e.balanceDue} · eventDate=${e.eventDate}`,
        observedAt: AS_OF,
        severity: e.balanceDue >= 300 ? 'medium' : 'low',
        linkedEntity: { kind: 'event', id: e.id, label: e.title },
        confidence: 88,
      });
    }
    if (e.pvStatus === 'proposal_sent') {
      signals.push({
        id: `sig-prop-${e.id}`,
        agentId: 'follow-up-hunter',
        type: 'proposal_sent_idle',
        title: `Proposal sent · ${e.title}`,
        summary: `${e.client} — $${e.value} package awaiting deposit or signature.`,
        triggerData: `event.pvStatus=proposal_sent · value=${e.value}`,
        observedAt: AS_OF,
        severity: 'medium',
        linkedEntity: { kind: 'event', id: e.id, label: e.title },
        confidence: 82,
      });
    }
    if (e.pvStatus === 'qualified') {
      signals.push({
        id: `sig-qual-${e.id}`,
        agentId: 'lead-concierge',
        type: 'qualified_no_touch',
        title: `Qualified lead · ${e.title}`,
        summary: `${e.client} — ${e.guests} guests · ${e.eventDate}.`,
        triggerData: `event.pvStatus=qualified`,
        observedAt: AS_OF,
        severity: 'low',
        linkedEntity: { kind: 'event', id: e.id, label: e.title },
        confidence: 76,
      });
    }
    if (e.pvStatus === 'lost') {
      signals.push({
        id: `sig-lost-${e.id}`,
        agentId: 'lead-concierge',
        type: 'lost_inquiry_followup',
        title: `Lost / archived · ${e.title}`,
        summary: `Capture learnings — ${e.client} · ${e.eventDate}.`,
        triggerData: `event.pvStatus=lost`,
        observedAt: AS_OF,
        severity: 'low',
        linkedEntity: { kind: 'event', id: e.id, label: e.title },
        confidence: 70,
      });
    }
    if (e.pvStatus === 'confirmed' && e.depositPaid > 0 && e.balanceDue > 0) {
      signals.push({
        id: `sig-up-${e.id}`,
        agentId: 'revenue-lift',
        type: 'confirmed_partial_deposit',
        title: `Upsell window · ${e.title}`,
        summary: `Deposit on file — consider add-ons before ${e.eventDate}.`,
        triggerData: `collected=${e.depositPaid} · revenue=${e.value}`,
        observedAt: AS_OF,
        severity: 'low',
        linkedEntity: { kind: 'event', id: e.id, label: e.title },
        confidence: 74,
      });
    }
  }

  for (const t of PV_TASKS) {
    if (t.title.includes('Kisi')) {
      signals.push({
        id: `sig-kisi-${t.id}`,
        agentId: 'booking-coordinator',
        type: 'automated_task_due',
        title: `Kisi task · ${t.linkedEvent}`,
        summary: t.automationSource,
        triggerData: `task.id=${t.id} · dueInDays=${t.daysUntil}`,
        observedAt: AS_OF,
        severity: t.priority === 'high' ? 'medium' : 'low',
        linkedEntity: { kind: 'task', id: t.id, label: t.linkedEvent },
        confidence: 91,
      });
    }
  }

  signals.push({
    id: 'sig-cal-june',
    agentId: 'calendar-conflict',
    type: 'same_day_load',
    title: 'June load-in density',
    summary: 'Dufferfest Jun 6, Miller/Harris Jun 7, WAREIA Jun 11 — Event Space flips.',
    triggerData: 'calendar.june2026.confirmed_cluster',
    observedAt: AS_OF,
    severity: 'medium',
    confidence: 85,
  });

  signals.push({
    id: 'sig-inv-lunch',
    agentId: 'calendar-conflict',
    type: 'recurring_overlap',
    title: 'ICT Investor Lunch · today',
    summary: 'Recurring series — 85 guests · Event Space 11:30a–2:00p.',
    triggerData: 'event.pv-investor-lunch · 2026-05-20',
    observedAt: AS_OF,
    severity: 'low',
    linkedEntity: { kind: 'event', id: 'pv-investor-lunch', label: 'Investor Lunch' },
    confidence: 90,
  });

  signals.push({
    id: 'sig-bingo',
    agentId: 'review-referral',
    type: 'fundraiser_nonprofit',
    title: 'Bingo fundraiser · May 15',
    summary: 'Mental health awareness event — post-event thank-you eligible.',
    triggerData: 'event.pv-bingo · confirmed',
    observedAt: AS_OF,
    severity: 'low',
    linkedEntity: { kind: 'event', id: 'pv-bingo', label: 'Bingo fundraiser' },
    confidence: 80,
  });

  signals.push({
    id: 'sig-kpi',
    agentId: 'owner-briefing',
    type: 'daily_priority_stack',
    title: 'Venue KPI snapshot',
    summary: `${PV_VENUE_SUMMARY.activeEvents} active · ${PV_VENUE_SUMMARY.proposalSent} proposals · ${PV_VENUE_SUMMARY.confirmed} confirmed.`,
    triggerData: 'venuesEventsSummary',
    observedAt: AS_OF,
    severity: 'low',
    confidence: 95,
  });

  return signals;
}

function buildRecommendations(signals: AgentSignal[]): AgentRecommendation[] {
  const recs: AgentRecommendation[] = [];

  recs.push({
    id: 'rec-kisi',
    agentId: 'booking-coordinator',
    priority: 'high',
    headline: 'Approve Kisi email batch before Dufferfest Jun 6',
    rationale: 'Six PV automated tasks queue door-access emails tied to confirmed events.',
    because: 'Send Kisi Email tasks observed in PV_TASKS with due dates within 10–30 days.',
    confidence: 91,
    linkedEvent: 'Dufferfest',
  });

  recs.push({
    id: 'rec-miller',
    agentId: 'follow-up-hunter',
    priority: 'high',
    headline: 'Miller/Harris shower — deposit reminder after proposal views',
    rationale: 'Proposal follow-up pattern; $225 balance due before Jun 7.',
    because: 'PV_FLAGSHIP_DEAL deposit received; balance milestone due 2026-06-01.',
    confidence: 88,
    linkedEvent: 'Miller/Harris Baby Shower',
  });

  recs.push({
    id: 'rec-wareia',
    agentId: 'balance-guardian',
    priority: 'medium',
    headline: 'WAREIA Jun 11 — recurring deposit path',
    rationale: 'Chapter series — $200 balance on confirmed instance.',
    because: 'WAREIA signal in pipeline + calendar Jun 11.',
    confidence: 84,
    linkedEvent: 'WAREIA',
  });

  recs.push({
    id: 'rec-villarreal',
    agentId: 'balance-guardian',
    priority: 'medium',
    headline: 'Villarreal grad party — final balance Jun 1',
    rationale: '$325 due after signed deposit.',
    because: 'balance_due signal on pv-villarreal.',
    confidence: 86,
    linkedEvent: 'Villarreal Grad Party',
  });

  recs.push({
    id: 'rec-vaughn',
    agentId: 'follow-up-hunter',
    priority: 'medium',
    headline: 'Vaughn Engagement — proposal sent, no deposit',
    rationale: '$650 package · Jun 2027 hold.',
    because: 'proposal_sent_idle signal on pv-vaughn.',
    confidence: 79,
    linkedEvent: 'Vaughn Engagement',
  });

  recs.push({
    id: 'rec-dessert',
    agentId: 'revenue-lift',
    priority: 'low',
    headline: 'Offer dessert station on Miller/Harris shower',
    rationale: PV_FLAGSHIP_DEAL.aiUpsells[0] ?? 'Add-on from playbook.',
    because: 'confirmed_partial_deposit on flagship deal.',
    confidence: 72,
    linkedEvent: 'Miller/Harris Baby Shower',
  });

  if (signals.some(s => s.id === 'sig-lost-pv-graduation-party')) {
    recs.push({
      id: 'rec-grad-lost',
      agentId: 'lead-concierge',
      priority: 'low',
      headline: 'Graduation Party lost — template post-mortem',
      rationale: 'Improve intake response for similar inquiries.',
      because: 'lost_inquiry_followup on Graduation Party.',
      confidence: 68,
      linkedEvent: 'Graduation Party',
    });
  }

  return recs;
}

function buildProposedActions(signals: AgentSignal[]): AgentProposedAction[] {
  const actions: AgentProposedAction[] = [];

  const push = (
    id: string,
    agentId: AgentId,
    partial: Omit<AgentProposedAction, 'id' | 'agentId'>,
  ) => {
    actions.push({ id, agentId, ...partial });
  };

  push('act-kisi-batch', 'booking-coordinator', {
    actionType: 'queue_approval',
    title: 'Approve Kisi batch · Dufferfest + Miller/Harris',
    description: 'Give Kisi access for allotted time and follow up with email (PV automated task).',
    trigger: '6× Send Kisi Email tasks in PV_TASKS',
    confidence: 91,
    riskLevel: 'medium',
    approvalStatus: 'pending',
    approvalRequiredBecause: AGENT_BY_ID['booking-coordinator'].approvalPolicy.approvalReason,
    runMode: 'queue_for_approval',
    linkedEvent: 'Dufferfest',
    waitingOn: 'Hannah Bayless',
    createdAt: AS_OF,
  });

  push('act-miller-followup', 'follow-up-hunter', {
    actionType: 'draft_message',
    title: 'Proposal follow-up · Miller/Harris Baby Shower',
    description: 'Deposit and agreement steps — gentle reminder before Jun 7.',
    trigger: 'Proposal follow-up signal · Kiasia Allen',
    confidence: 88,
    riskLevel: 'low',
    approvalStatus: 'pending',
    approvalRequiredBecause: AGENT_BY_ID['follow-up-hunter'].approvalPolicy.approvalReason,
    runMode: 'queue_for_approval',
    linkedEvent: 'Miller/Harris Baby Shower',
    waitingOn: 'Hannah Bayless',
    createdAt: AS_OF,
  });

  push('act-villarreal-bal', 'balance-guardian', {
    actionType: 'send_reminder',
    title: 'Final balance reminder · Villarreal Grad Party',
    description: 'Remaining $325 — due Jun 1 per payment milestone.',
    trigger: 'balance_due on pv-villarreal',
    confidence: 86,
    riskLevel: 'medium',
    approvalStatus: 'pending',
    approvalRequiredBecause: AGENT_BY_ID['balance-guardian'].approvalPolicy.approvalReason,
    runMode: 'queue_for_approval',
    linkedEvent: 'Villarreal Grad Party',
    waitingOn: 'Jason Lavender',
    createdAt: AS_OF,
  });

  push('act-investor-door', 'calendar-conflict', {
    actionType: 'flag_calendar',
    title: 'Investor Lunch · May 20 door access window',
    description: 'Confirm Event Space access 11:30a–2:00p — recurring ICT series.',
    trigger: 'sig-inv-lunch · same-day confirmed',
    confidence: 90,
    riskLevel: 'low',
    approvalStatus: 'pending',
    approvalRequiredBecause: AGENT_BY_ID['calendar-conflict'].approvalPolicy.approvalReason,
    runMode: 'observe_only',
    linkedEvent: 'Investor Lunch',
    waitingOn: 'Jason Lavender',
    createdAt: AS_OF,
  });

  push('act-michelle-layout', 'lead-concierge', {
    actionType: 'draft_message',
    title: 'Michelle Bradbury layout follow-up',
    description: 'Welcome-home celebration — tables & decor Q&A from inbox pattern.',
    trigger: 'Tour / availability response pattern',
    confidence: 75,
    riskLevel: 'low',
    approvalStatus: 'pending',
    approvalRequiredBecause: AGENT_BY_ID['lead-concierge'].approvalPolicy.approvalReason,
    runMode: 'queue_for_approval',
    linkedEvent: 'Michelle Bradbury',
    waitingOn: 'Event Coordinator',
    createdAt: AS_OF,
  });

  push('act-duffer-bal', 'balance-guardian', {
    actionType: 'send_reminder',
    title: 'Dufferfest balance · Jeff Morten',
    description: '$325 balance before Jun 6 golf outing.',
    trigger: 'balance_due on pv-dufferfest',
    confidence: 84,
    riskLevel: 'medium',
    approvalStatus: 'pending',
    approvalRequiredBecause: AGENT_BY_ID['balance-guardian'].approvalPolicy.approvalReason,
    runMode: 'queue_for_approval',
    linkedEvent: 'Dufferfest',
    waitingOn: 'Jordan Lee',
    createdAt: AS_OF,
  });

  push('act-bingo-thanks', 'review-referral', {
    actionType: 'draft_message',
    title: 'Thank-you · Bingo fundraiser',
    description: 'Nonprofit coordination thank-you — no payment language.',
    trigger: 'sig-bingo · fundraiser_nonprofit',
    confidence: 80,
    riskLevel: 'low',
    approvalStatus: 'not_required',
    approvalRequiredBecause: 'Low-risk post-event template — optional review.',
    runMode: 'autonomous_low_risk',
    linkedEvent: 'Bingo fundraiser',
    createdAt: AS_OF,
  });

  void signals;
  return actions;
}

function buildActivities(actions: AgentProposedAction[]): AgentActivity[] {
  const completed: AgentActivity[] = [
    {
      id: 'act-log-1',
      agentId: 'booking-coordinator',
      agentName: agentName('booking-coordinator'),
      at: '8:14a',
      summary: 'Queued Send Kisi Email · Dufferfest (Jeff Morten)',
      actionType: 'schedule_task',
      state: 'completed',
    },
    {
      id: 'act-log-2',
      agentId: 'balance-guardian',
      agentName: agentName('balance-guardian'),
      at: '9:02a',
      summary: 'Drafted final balance path · Villarreal Grad Party',
      actionType: 'send_reminder',
      state: 'completed',
    },
    {
      id: 'act-log-3',
      agentId: 'follow-up-hunter',
      agentName: agentName('follow-up-hunter'),
      at: '9:41a',
      summary: 'Proposal follow-up · Miller/Harris Baby Shower',
      actionType: 'draft_message',
      state: 'needs_review',
    },
    {
      id: 'act-log-4',
      agentId: 'booking-coordinator',
      agentName: agentName('booking-coordinator'),
      at: '10:05a',
      summary: 'WAREIA Jun 11 hold · Ely Randelas recurring',
      actionType: 'flag_calendar',
      state: 'completed',
    },
    {
      id: 'act-log-5',
      agentId: 'lead-concierge',
      agentName: agentName('lead-concierge'),
      at: '10:18a',
      summary: 'Sanitized inquiry response · Graduation Party (lost)',
      actionType: 'draft_message',
      state: 'observed',
    },
    {
      id: 'act-log-6',
      agentId: 'review-referral',
      agentName: agentName('review-referral'),
      at: '10:35a',
      summary: 'Thank-you note · Bingo fundraiser / mental health awareness',
      actionType: 'draft_message',
      state: 'completed',
    },
    {
      id: 'act-log-7',
      agentId: 'owner-briefing',
      agentName: agentName('owner-briefing'),
      at: '7:05a',
      summary: `Briefing ready · ${PV_VENUE_SUMMARY.activeEvents} active events, Investor Lunch today`,
      actionType: 'owner_summary',
      state: 'completed',
    },
    {
      id: 'act-log-8',
      agentId: 'calendar-conflict',
      agentName: agentName('calendar-conflict'),
      at: '9:33a',
      summary: 'Event Space OK for WAREIA May 14 + Jun 11 flip windows',
      actionType: 'flag_calendar',
      state: 'completed',
    },
  ];

  return completed;
}

function deriveAgentStates(
  signals: AgentSignal[],
  pending: AgentProposedAction[],
): AgentRuntimeState[] {
  return AGENT_REGISTRY.map(def => {
    const agentSignals = signals.filter(s => s.agentId === def.id);
    const queue = pending.filter(p => p.agentId === def.id && p.approvalStatus === 'pending');
    const lastSig = agentSignals[0];
    let status: AgentStatus = 'active';
    if (queue.length >= 2) status = 'attention';
    else if (agentSignals.length === 0 && def.id !== 'owner-briefing') status = 'idle';

    const confidence =
      agentSignals.length > 0
        ? Math.round(agentSignals.reduce((n, s) => n + s.confidence, 0) / agentSignals.length)
        : 72;

    return {
      id: def.id,
      name: def.name,
      shortName: def.shortName,
      status,
      runMode: def.runMode,
      requiresApproval: def.approvalPolicy.requiresApproval,
      lastRunAt: def.id === 'owner-briefing' ? '7:05a' : relTime(12 + def.priority),
      lastSignal: lastSig?.title,
      confidence,
      priority: def.priority,
      queueDepth: queue.length,
      actionsToday: agentSignals.length + (def.id === 'owner-briefing' ? 1 : 0),
      tagline: def.purpose.slice(0, 72) + (def.purpose.length > 72 ? '…' : ''),
    };
  });
}

function buildOwnerBriefing(
  recommendations: AgentRecommendation[],
): OwnerBriefingInputs {
  const balances = PV_PIPELINE_EVENTS.filter(e => e.balanceDue > 0 && e.pvStatus === 'confirmed')
    .slice(0, 4)
    .map((e, i) => ({
      id: `bb-${i}`,
      client: e.client,
      event: `${e.title} · ${e.eventDate}`,
      amount: e.balanceDue,
      due: 'Jun 1',
      severity: (e.balanceDue >= 300 ? 'medium' : 'low') as AgentRiskLevel,
      note: `$${e.depositPaid} deposit received`,
    }));

  return {
    headline: PV_EXECUTIVE_ANCHORS.focusHeadline,
    bullets: [
      'ICT Investor Lunch today 11:30a · Event Space · 85 guests',
      'Bingo fundraiser · 4:00p · mental health awareness',
      `${PV_VENUE_SUMMARY.activeEvents} active · ${pendingCount()} approvals in queue`,
    ],
    overnightActions: PV_EXECUTIVE_ANCHORS.overnightSamples.map((action, i) => ({
      id: `on-${i}`,
      agent: ['Balance Guardian', 'Follow-Up Hunter', 'Booking Coordinator', 'Owner Briefing'][i] ?? 'Agent',
      action,
      at: ['2:14a', '3:40a', '4:55a', '7:05a'][i] ?? '—',
      state: (i === 2 ? 'needs_review' : 'completed') as 'completed' | 'needs_review',
    })),
    recommendations: recommendations.slice(0, 6).map(r => ({
      id: r.id,
      priority: r.priority,
      text: r.headline,
    })),
    balancesAttention: balances,
  };
}

function pendingCount(): number {
  return 3;
}

function buildDealRail(pending: AgentProposedAction[]): DealAutopilotRailView {
  const flagship = PV_FLAGSHIP_DEAL;
  const related = pending.filter(
    p =>
      p.linkedEvent?.includes('Miller') ||
      p.linkedEvent?.includes('Baby Shower') ||
      p.agentId === 'follow-up-hunter' ||
      p.agentId === 'booking-coordinator',
  );

  return {
    recommendedNextAction: flagship.nextAction,
    draftedClientMessage: `Hi Kiasia — your Miller/Harris baby shower is confirmed for Sunday, June 7 (3:00p–7:00p) in the Event Space. We've received your deposit; the remaining balance is due before the event. I'll send door-access details separately. — Hannah @ HuB on Lewis`,
    activeAutomations: [
      {
        id: 'au-kisi',
        name: 'Send Kisi Email · shower',
        agent: agentName('booking-coordinator'),
        state: related.some(p => p.id === 'act-kisi-batch') ? 'awaiting_approval' : 'running',
      },
      {
        id: 'au-bal',
        name: 'Deposit / balance reminders',
        agent: agentName('balance-guardian'),
        state: 'running',
      },
      {
        id: 'au-up',
        name: 'Dessert station upsell',
        agent: agentName('revenue-lift'),
        state: 'running',
      },
      {
        id: 'au-fu',
        name: 'Proposal follow-up sequence',
        agent: agentName('follow-up-hunter'),
        state: related.some(p => p.id === 'act-miller-followup') ? 'awaiting_approval' : 'running',
      },
    ],
    riskScoreExplanation:
      'Risk is low-moderate: deposit received per Perfect Venue workflow; Kisi email still queued. Autopilot will not send payment links or door codes until coordinator approval.',
    upsellRecommendations: flagship.aiUpsells,
  };
}

function buildRiskAlerts(signals: AgentSignal[]): AgentEngineSnapshot['riskAlerts'] {
  return [
    {
      id: 'risk-1',
      level: 'high',
      agentId: 'booking-coordinator',
      text: PV_AI_ATTENTION[0]?.text ?? 'Dufferfest — Kisi emails due before Jun 6 load-in.',
    },
    {
      id: 'risk-2',
      level: 'medium',
      agentId: 'balance-guardian',
      text: PV_AI_ATTENTION[1]?.text ?? 'WAREIA Jun 11 — deposit path on recurring series.',
    },
    {
      id: 'risk-3',
      level: 'low',
      agentId: 'lead-concierge',
      text: 'Graduation Party May 16 marked lost — capture reason before re-engaging similar inquiries.',
    },
  ];
}

function evaluateAgentEngine(): AgentEngineSnapshot {
  const intel = runIntelligenceEngine();
  const base = intelligenceToAgentSnapshot(intel);
  const pendingApprovals = base.proposedActions.filter(p => p.approvalStatus === 'pending');
  return {
    ...base,
    pendingApprovals,
    dealRail: buildDealRail(pendingApprovals),
    riskAlerts: buildRiskAlerts(base.signals),
    todayActions: buildActivities(pendingApprovals).filter(a => a.at !== '7:05a').slice(0, 6),
  };
}

let cachedSnapshot: AgentEngineSnapshot | null = null;

/** Single evaluated snapshot for the session (deterministic). */
export function getAgentEngineSnapshot(): AgentEngineSnapshot {
  if (!cachedSnapshot) {
    cachedSnapshot = evaluateAgentEngine();
  }
  return cachedSnapshot;
}

/** Force re-evaluation (e.g. after seed hot-reload in dev). */
export function resetAgentEngineCache(): void {
  cachedSnapshot = null;
  resetIntelligenceEngine();
}

export function getAgentSignalsFor(agentId: AgentId): AgentSignal[] {
  return getAgentEngineSnapshot().signals.filter(s => s.agentId === agentId);
}

export function getAgentWorkflows(): import('./types.js').AgentWorkflow[] {
  return AGENT_REGISTRY.map(def => ({
    id: `wf-${def.id}`,
    agentId: def.id,
    title: def.name.replace(' Agent', ''),
    description: def.purpose,
    enabled: def.id !== 'review-referral' || true,
    approvalMode:
      def.approvalPolicy.defaultRunMode === 'autonomous_low_risk'
        ? 'auto'
        : def.approvalPolicy.defaultRunMode === 'suggest'
          ? 'review_low_risk'
          : 'always_review',
    lastRun: def.id === 'owner-briefing' ? 'Today · 7:05a' : 'Today · 9:50a',
  }));
}

void PV_WEEK_EVENTS;
