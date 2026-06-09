/**
 * Hub operational intelligence — shared contract (rules-first, LLM-optional).
 */

export type IntelligenceAgentId =
  | 'balance-guardian'
  | 'follow-up-hunter'
  | 'booking-coordinator'
  | 'calendar-conflict'
  | 'owner-briefing'
  | 'revenue-lift'
  | 'review-referral'
  | 'client-readiness'
  | 'lead-concierge';

export type SignalSeverity = 'low' | 'medium' | 'high' | 'critical';

export type OperationalSignalType =
  | 'balance_due'
  | 'payment_risk'
  | 'proposal_sent_idle'
  | 'proposal_viewed_no_deposit'
  | 'inquiry_aging'
  | 'qualified_no_touch'
  | 'stale_opportunity'
  | 'automated_task_due'
  | 'pre_event_window'
  | 'calendar_collision'
  | 'staffing_pressure'
  | 'underutilized_day'
  | 'upsell_window'
  | 'review_eligible'
  | 'readiness_gap'
  | 'daily_priority_stack'
  | 'workflow_trigger';

export type ScoreKey =
  | 'operationalPressure'
  | 'eventReadiness'
  | 'bookingHealth'
  | 'conversionProbability'
  | 'followUpUrgency'
  | 'paymentRisk'
  | 'staffingPressure'
  | 'clientEngagement'
  | 'automationConfidence';

export type IntelligenceScores = Record<ScoreKey, number>;

export type RecommendedActionType =
  | 'create_task'
  | 'queue_approval'
  | 'draft_message'
  | 'send_reminder'
  | 'notify_owner'
  | 'portal_reminder'
  | 'escalate_risk'
  | 'update_score'
  | 'create_signal'
  | 'suggest_upsell';

export interface RelatedEntity {
  kind: 'event' | 'task' | 'inquiry' | 'client' | 'calendar';
  id: string;
  label: string;
}

export interface RecommendedAction {
  id: string;
  type: RecommendedActionType;
  title: string;
  summary: string;
  sourceAgent: IntelligenceAgentId;
  confidence: number;
  requiresApproval: boolean;
  linkedEntity?: RelatedEntity;
}

export interface OperationalSignal {
  id: string;
  type: OperationalSignalType;
  severity: SignalSeverity;
  sourceAgent: IntelligenceAgentId;
  title: string;
  summary: string;
  relatedEntities: RelatedEntity[];
  confidence: number;
  generatedAt: string;
  expiresAt?: string;
  recommendedActions: RecommendedAction[];
  requiresApproval: boolean;
  /** Deterministic trigger explanation */
  triggerRule: string;
}

export interface WorkflowTriggerMatch {
  triggerId: string;
  entity: RelatedEntity;
  firedAt: string;
}

export interface WorkflowActionPlan {
  id: string;
  triggerId: string;
  actions: RecommendedAction[];
}

export interface IntelligenceRecommendation {
  id: string;
  sourceAgent: IntelligenceAgentId;
  priority: 'low' | 'medium' | 'high';
  headline: string;
  rationale: string;
  because: string;
  confidence: number;
  linkedEntity?: RelatedEntity;
}

export interface IntelligenceContextMeta {
  venueId: string;
  venueName: string;
  asOfDate: string;
  source: 'perfect-venue-seed' | 'api' | 'mongo';
  activeEventCount: number;
}

export interface IntelligenceSnapshot {
  generatedAt: string;
  context: IntelligenceContextMeta;
  scores: IntelligenceScores;
  signals: OperationalSignal[];
  recommendations: IntelligenceRecommendation[];
  proposedActions: RecommendedAction[];
  workflowPlans: WorkflowActionPlan[];
  agentActivity: Array<{
    id: string;
    agentId: IntelligenceAgentId;
    summary: string;
    at: string;
    state: 'completed' | 'needs_review' | 'running';
  }>;
}
