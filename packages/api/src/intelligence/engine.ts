import type { IntelligenceSnapshot } from '@hub-crm/shared';

/**
 * Server intelligence runner — stub for Mongo/API ingestion.
 * Web demo uses packages/web/src/intelligence (PV seed).
 * Wire this to repositories when events are persisted in hub_crm.
 */
export interface VenueEventInput {
  id: string;
  title: string;
  client: string;
  eventDate: string;
  status: string;
  value: number;
  depositPaid: number;
  balanceDue: number;
  guests: number;
}

export function createEmptyIntelligenceSnapshot(venueName: string): IntelligenceSnapshot {
  const now = new Date().toISOString();
  const emptyScores = {
    operationalPressure: 0,
    eventReadiness: 0,
    bookingHealth: 0,
    conversionProbability: 0,
    followUpUrgency: 0,
    paymentRisk: 0,
    staffingPressure: 0,
    clientEngagement: 0,
    automationConfidence: 0,
  };
  return {
    generatedAt: now,
    context: {
      venueId: 'api',
      venueName,
      asOfDate: now.slice(0, 10),
      source: 'api',
      activeEventCount: 0,
    },
    scores: emptyScores,
    signals: [],
    recommendations: [],
    proposedActions: [],
    workflowPlans: [],
    agentActivity: [],
  };
}

/** Future: evaluateIntelligenceFromEvents(events: VenueEventInput[]) */
export async function runApiIntelligenceEngine(
  _tenantId: string,
  venueName: string,
): Promise<IntelligenceSnapshot> {
  return createEmptyIntelligenceSnapshot(venueName);
}
