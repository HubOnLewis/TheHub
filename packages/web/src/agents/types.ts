/**
 * Hub Autopilot — agent orchestration foundation types.
 * Demo mock engine implements these; future API/worker layer will persist runs.
 */

export type AgentId =
  | 'lead-concierge'
  | 'follow-up-hunter'
  | 'booking-coordinator'
  | 'revenue-lift'
  | 'balance-guardian'
  | 'review-referral'
  | 'calendar-conflict'
  | 'owner-briefing';

export type AgentStatus = 'active' | 'idle' | 'attention' | 'paused';

export type AgentRiskLevel = 'low' | 'medium' | 'high';

export type AgentActionType =
  | 'draft_message'
  | 'schedule_task'
  | 'send_reminder'
  | 'flag_calendar'
  | 'suggest_upsell'
  | 'queue_approval'
  | 'owner_summary'
  | 'suppress_outbound';

export type AgentApprovalStatus =
  | 'not_required'
  | 'pending'
  | 'approved'
  | 'dismissed'
  | 'expired';

export type AgentRunMode =
  | 'observe_only'
  | 'suggest'
  | 'queue_for_approval'
  | 'autonomous_low_risk';

export type AgentCapability =
  | 'inbox_draft'
  | 'proposal_followup'
  | 'deposit_reminder'
  | 'calendar_scan'
  | 'task_spawn'
  | 'upsell_surface'
  | 'owner_digest'
  | 'post_event_review';

export interface AgentContext {
  venueId: string;
  venueName: string;
  asOfDate: string;
  activeEventCount: number;
  source: 'perfect-venue-seed' | 'api';
}

export interface AgentSignal {
  id: string;
  agentId: AgentId;
  type: string;
  title: string;
  summary: string;
  triggerData: string;
  observedAt: string;
  severity: AgentRiskLevel;
  linkedEntity?: { kind: 'event' | 'task' | 'calendar'; id: string; label: string };
  confidence: number;
}

export interface AgentRecommendation {
  id: string;
  agentId: AgentId;
  priority: 'low' | 'medium' | 'high';
  headline: string;
  rationale: string;
  because: string;
  confidence: number;
  linkedEvent?: string;
}

export interface AgentProposedAction {
  id: string;
  agentId: AgentId;
  actionType: AgentActionType;
  title: string;
  description: string;
  trigger: string;
  confidence: number;
  riskLevel: AgentRiskLevel;
  approvalStatus: AgentApprovalStatus;
  approvalRequiredBecause: string;
  runMode: AgentRunMode;
  linkedEvent?: string;
  waitingOn?: string;
  createdAt: string;
}

export interface AgentActivity {
  id: string;
  agentId: AgentId;
  agentName: string;
  at: string;
  summary: string;
  actionType?: AgentActionType;
  state: 'completed' | 'needs_review' | 'pending_approval' | 'observed';
}

export interface AgentWorkflow {
  id: string;
  agentId: AgentId;
  title: string;
  description: string;
  enabled: boolean;
  approvalMode: 'auto' | 'review_low_risk' | 'always_review';
  lastRun?: string;
}

export interface AgentApprovalPolicy {
  defaultRunMode: AgentRunMode;
  requiresApproval: boolean;
  approvalReason: string;
  maxAutonomousAmount?: number;
}

export interface AgentDefinition {
  id: AgentId;
  name: string;
  shortName: string;
  purpose: string;
  capabilities: AgentCapability[];
  watchedSignals: string[];
  proposedActions: AgentActionType[];
  approvalPolicy: AgentApprovalPolicy;
  safetyNotes: string[];
  runMode: AgentRunMode;
  priority: number;
}

export interface AgentRuntimeState {
  id: AgentId;
  name: string;
  shortName: string;
  status: AgentStatus;
  runMode: AgentRunMode;
  requiresApproval: boolean;
  lastRunAt: string;
  lastSignal?: string;
  confidence: number;
  priority: number;
  queueDepth: number;
  actionsToday: number;
  tagline: string;
}

export interface OwnerBriefingInputs {
  headline: string;
  bullets: string[];
  overnightActions: Array<{ id: string; agent: string; action: string; at: string; state: 'completed' | 'needs_review' }>;
  recommendations: Array<{ id: string; priority: 'low' | 'medium' | 'high'; text: string }>;
  balancesAttention: Array<{
    id: string;
    client: string;
    event: string;
    amount: number;
    due: string;
    severity: AgentRiskLevel;
    note: string;
  }>;
}

export interface DealAutopilotRailView {
  recommendedNextAction: string;
  draftedClientMessage: string;
  activeAutomations: Array<{
    id: string;
    name: string;
    agent: string;
    state: 'running' | 'awaiting_approval' | 'paused';
  }>;
  riskScoreExplanation: string;
  upsellRecommendations: string[];
}

export interface AutopilotDashboardWidget {
  actionsCompletedToday: number;
  approvalsWaiting: number;
  revenueOpportunitiesFound: number;
  followUpsScheduledAuto: number;
  signalsObserved: number;
}

export interface AgentEngineSnapshot {
  generatedAt: string;
  context: AgentContext;
  signals: AgentSignal[];
  recommendations: AgentRecommendation[];
  proposedActions: AgentProposedAction[];
  activities: AgentActivity[];
  pendingApprovals: AgentProposedAction[];
  agentStates: AgentRuntimeState[];
  ownerBriefing: OwnerBriefingInputs;
  dashboardWidget: AutopilotDashboardWidget;
  dealRail: DealAutopilotRailView;
  riskAlerts: Array<{ id: string; level: AgentRiskLevel; text: string; agentId: AgentId }>;
  todayActions: AgentActivity[];
}
