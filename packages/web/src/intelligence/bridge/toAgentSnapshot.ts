/**
 * Bridge intelligence engine output → legacy Autopilot agent types (UI compatibility).
 */

import type { IntelligenceSnapshot, OperationalSignal, RecommendedAction } from '@hub-crm/shared';
import { AGENT_BY_ID, AGENT_REGISTRY } from '../../agents/registry.js';
import type {
  AgentEngineSnapshot,
  AgentId,
  AgentProposedAction,
  AgentRecommendation,
  AgentRiskLevel,
  AgentSignal,
  AgentRuntimeState,
  AgentStatus,
} from '../../agents/types.js';
import { PV_EXECUTIVE_ANCHORS, PV_FLAGSHIP_DEAL, PV_PIPELINE_EVENTS, PV_TASKS } from '../../data/perfectVenueSeed.js';
import { PV_AI_ATTENTION } from '../../data/perfectVenueSeed.js';

const LEGACY_AGENT_IDS: AgentId[] = [
  'balance-guardian',
  'follow-up-hunter',
  'booking-coordinator',
  'calendar-conflict',
  'owner-briefing',
  'revenue-lift',
  'review-referral',
  'lead-concierge',
];

function isLegacyAgent(id: string): id is AgentId {
  return (LEGACY_AGENT_IDS as string[]).includes(id);
}

function mapSeverity(s: OperationalSignal['severity']): AgentRiskLevel {
  if (s === 'critical') return 'high';
  return s;
}

function mapSignal(s: OperationalSignal): AgentSignal | null {
  if (!isLegacyAgent(s.sourceAgent)) return null;
  const linked = s.relatedEntities[0];
  return {
    id: s.id,
    agentId: s.sourceAgent,
    type: s.type,
    title: s.title,
    summary: s.summary,
    triggerData: s.triggerRule,
    observedAt: s.generatedAt,
    severity: mapSeverity(s.severity),
    linkedEntity: linked
      ? {
          kind: linked.kind === 'inquiry' ? 'event' : linked.kind === 'client' ? 'event' : linked.kind,
          id: linked.id,
          label: linked.label,
        }
      : undefined,
    confidence: s.confidence,
  };
}

function mapRecommendation(r: IntelligenceSnapshot['recommendations'][0]): AgentRecommendation | null {
  if (!isLegacyAgent(r.sourceAgent)) return null;
  return {
    id: r.id,
    agentId: r.sourceAgent,
    priority: r.priority,
    headline: r.headline,
    rationale: r.rationale,
    because: r.because,
    confidence: r.confidence,
    linkedEvent: r.linkedEntity?.label,
  };
}

function mapAction(a: RecommendedAction): AgentProposedAction | null {
  if (!isLegacyAgent(a.sourceAgent)) return null;
  const def = AGENT_BY_ID[a.sourceAgent];
  const actionType =
    a.type === 'draft_message'
      ? 'draft_message'
      : a.type === 'send_reminder'
        ? 'send_reminder'
        : a.type === 'create_task'
          ? 'schedule_task'
          : a.type === 'queue_approval'
            ? 'queue_approval'
            : a.type === 'suggest_upsell'
              ? 'suggest_upsell'
              : 'queue_approval';

  return {
    id: a.id,
    agentId: a.sourceAgent,
    actionType,
    title: a.title,
    description: a.summary,
    trigger: a.summary,
    confidence: a.confidence,
    riskLevel: a.requiresApproval ? 'medium' : 'low',
    approvalStatus: a.requiresApproval ? 'pending' : 'not_required',
    approvalRequiredBecause: def.approvalPolicy.approvalReason,
    runMode: def.approvalPolicy.defaultRunMode,
    linkedEvent: a.linkedEntity?.label,
    waitingOn: 'Coordinator',
    createdAt: new Date().toISOString(),
  };
}

export function intelligenceToAgentSnapshot(intel: IntelligenceSnapshot): AgentEngineSnapshot {
  const signals = intel.signals.map(mapSignal).filter((s): s is AgentSignal => s != null);
  const recommendations = intel.recommendations
    .map(mapRecommendation)
    .filter((r): r is AgentRecommendation => r != null);
  const proposedActions = intel.proposedActions
    .map(mapAction)
    .filter((a): a is AgentProposedAction => a != null);

  const pendingApprovals = proposedActions.filter(p => p.approvalStatus === 'pending');

  const agentStates: AgentRuntimeState[] = AGENT_REGISTRY.map(def => {
    const agentSignals = signals.filter(s => s.agentId === def.id);
    const queue = pendingApprovals.filter(p => p.agentId === def.id).length;
    let status: AgentStatus = 'active';
    if (queue >= 2) status = 'attention';
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
      lastRunAt: def.id === 'owner-briefing' ? '7:05a' : 'Today · 9:50a',
      lastSignal: agentSignals[0]?.title,
      confidence,
      priority: def.priority,
      queueDepth: queue,
      actionsToday: agentSignals.length,
      tagline: def.purpose.slice(0, 72) + (def.purpose.length > 72 ? '…' : ''),
    };
  });

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
    generatedAt: intel.generatedAt,
    context: {
      venueId: intel.context.venueId,
      venueName: intel.context.venueName,
      asOfDate: intel.context.asOfDate,
      activeEventCount: intel.context.activeEventCount,
      source: 'perfect-venue-seed',
    },
    signals,
    recommendations,
    proposedActions,
    activities: intel.agentActivity.map((a, i) => {
      const agentId: AgentId = isLegacyAgent(a.agentId) ? a.agentId : 'owner-briefing';
      return {
        id: `ia-${i}`,
        agentId,
        agentName: AGENT_BY_ID[agentId].shortName,
        summary: a.summary,
        at: a.at,
        state:
          a.state === 'needs_review'
            ? ('pending_approval' as const)
            : a.state === 'running'
              ? ('observed' as const)
              : ('completed' as const),
      };
    }),
    pendingApprovals,
    agentStates,
    ownerBriefing: {
      headline: PV_EXECUTIVE_ANCHORS.focusHeadline,
      bullets: [
        'ICT Investor Lunch today 11:30a · Event Space · 85 guests',
        'Bingo fundraiser · 4:00p',
        `${intel.context.activeEventCount} active · ${pendingApprovals.length} approvals in queue`,
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
    },
    dashboardWidget: {
      actionsCompletedToday: intel.agentActivity.filter(a => a.state === 'completed').length,
      approvalsWaiting: pendingApprovals.length,
      revenueOpportunitiesFound: signals.filter(s => s.agentId === 'revenue-lift').length + 2,
      followUpsScheduledAuto: signals.filter(s => s.agentId === 'follow-up-hunter').length + PV_TASKS.length,
      signalsObserved: signals.length,
    },
    dealRail: {
      recommendedNextAction: PV_FLAGSHIP_DEAL.nextAction,
      draftedClientMessage:
        'Hi Kiasia — your Miller/Harris baby shower is confirmed for Sunday, June 7. Deposit received; balance due before the event. — Hannah @ HuB on Lewis',
      activeAutomations: [],
      riskScoreExplanation: 'Deterministic intelligence engine — no LLM required.',
      upsellRecommendations: PV_FLAGSHIP_DEAL.aiUpsells,
    },
    riskAlerts: [
      {
        id: 'risk-1',
        level: 'high',
        agentId: 'booking-coordinator',
        text: PV_AI_ATTENTION[0]?.text ?? '',
      },
      {
        id: 'risk-2',
        level: 'medium',
        agentId: 'balance-guardian',
        text: PV_AI_ATTENTION[1]?.text ?? '',
      },
    ],
    todayActions: [],
  };
}
