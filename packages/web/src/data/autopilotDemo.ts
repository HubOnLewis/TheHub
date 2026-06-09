/**
 * The Hub Autopilot — UI adapters over the agent mock engine.
 * Data is derived from registry + perfectVenueSeed evaluation (not static cards).
 */

import { getAgentEngineSnapshot, getAgentWorkflows } from '../agents/mockAgentEngine.js';
import type { AgentRiskLevel, AgentRunMode } from '../agents/types.js';

export type AgentRunStatus = 'active' | 'idle' | 'attention' | 'paused';

export interface AutopilotAgentCard {
  id: string;
  name: string;
  tagline: string;
  status: AgentRunStatus;
  actionsToday: number;
  lastBeat: string;
  queueDepth: number;
  runMode: AgentRunMode;
  requiresApproval: boolean;
  confidence: number;
  lastSignal?: string;
  approvalModeLabel: string;
}

function runModeLabel(mode: AgentRunMode): string {
  switch (mode) {
    case 'observe_only':
      return 'Observe only';
    case 'suggest':
      return 'Suggest';
    case 'queue_for_approval':
      return 'Queue for approval';
    case 'autonomous_low_risk':
      return 'Autonomous (low risk)';
    default:
      return mode;
  }
}

const snap = () => getAgentEngineSnapshot();

export const AUTOPILOT_AGENTS: AutopilotAgentCard[] = snap().agentStates.map(a => ({
  id: a.id,
  name: a.name,
  tagline: a.tagline,
  status: a.status,
  actionsToday: a.actionsToday,
  lastBeat: a.lastRunAt,
  queueDepth: a.queueDepth,
  runMode: a.runMode,
  requiresApproval: a.requiresApproval,
  confidence: a.confidence,
  lastSignal: a.lastSignal,
  approvalModeLabel: runModeLabel(a.runMode),
}));

export const AUTOPILOT_IMPACT_METRICS = [
  { id: 'm1', label: 'Staff hours saved (30d)', value: '28h', delta: '+9%', hint: 'vs prior month (tracked tasks)' },
  { id: 'm2', label: 'Signals observed', value: String(snap().signals.length), delta: `${snap().context.activeEventCount} events`, hint: 'from PV seed evaluation' },
  { id: 'm3', label: 'Approvals cleared', value: '88%', delta: 'goal 85%', hint: 'human-in-the-loop pass rate' },
  { id: 'm4', label: 'Add-on ideas surfaced', value: String(snap().dashboardWidget.revenueOpportunitiesFound), delta: 'Revenue Lift', hint: 'structured recommendations' },
];

export const AUTOPILOT_TODAY_ACTIONS = snap().todayActions.map(a => ({
  id: a.id,
  agent: a.agentName,
  action: a.summary,
  when: a.at,
  state: a.state === 'observed' ? ('pending_approval' as const) : a.state,
}));

export interface AutopilotPendingApproval {
  id: string;
  title: string;
  agent: string;
  agentId: string;
  risk: AgentRiskLevel;
  waiting: string;
  trigger: string;
  confidence: number;
  approvalRequiredBecause: string;
  proposedAction: string;
}

export const AUTOPILOT_PENDING_APPROVALS: AutopilotPendingApproval[] = snap().pendingApprovals.map(p => ({
  id: p.id,
  title: p.title,
  agent: snap().agentStates.find(s => s.id === p.agentId)?.shortName ?? p.agentId,
  agentId: p.agentId,
  risk: p.riskLevel,
  waiting: p.waitingOn ?? 'Coordinator',
  trigger: p.trigger,
  confidence: p.confidence,
  approvalRequiredBecause: p.approvalRequiredBecause,
  proposedAction: p.description,
}));

export const AUTOPILOT_SIGNAL_FEED = snap().signals.slice(0, 12).map(s => ({
  id: s.id,
  agentId: s.agentId,
  agent: snap().agentStates.find(a => a.id === s.agentId)?.shortName ?? s.agentId,
  title: s.title,
  summary: s.summary,
  trigger: s.triggerData,
  confidence: s.confidence,
  severity: s.severity,
  observedAt: s.observedAt,
}));

export const AUTOPILOT_RECOMMENDATIONS = snap().recommendations.map(r => ({
  id: r.id,
  agent: snap().agentStates.find(a => a.id === r.agentId)?.shortName ?? r.agentId,
  priority: r.priority,
  headline: r.headline,
  because: r.because,
  confidence: r.confidence,
}));

export const AUTOPILOT_RISK_ALERTS = snap().riskAlerts.map(r => ({
  id: r.id,
  level: r.level,
  text: r.text,
}));

export const AUTOPILOT_ACTIVITY_FEED = snap().activities.map(f => ({
  id: f.id,
  at: f.at,
  agent: f.agentName,
  text: f.summary,
}));

export const AUTOPILOT_DASHBOARD_WIDGET = snap().dashboardWidget;

export const OPPORTUNITY_AUTOPILOT_RAIL = snap().dealRail;

export type WorkflowApprovalMode = 'auto' | 'review_low_risk' | 'always_review';

export interface AutopilotWorkflowCard {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  approvalMode: WorkflowApprovalMode;
  lastRun?: string;
}

export const AUTOPILOT_WORKFLOW_CARDS: AutopilotWorkflowCard[] = getAgentWorkflows();
