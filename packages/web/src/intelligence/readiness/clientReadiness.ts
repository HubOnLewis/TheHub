import type { IntelligenceScores } from '@hub-crm/shared';
import { runIntelligenceEngine } from '../engine.js';
import type { PortalEventState } from '../../portal/types.js';
import { PORTAL_DEMO_EVENT } from '../../portal/demoData.js';

export interface ClientReadinessIntel {
  score: number;
  label: string;
  factors: Array<{ key: string; label: string; pct: number }>;
  conciergeSuggestions: string[];
  nextSteps: string[];
  risks: string[];
}

/** Rules-first portal readiness — merges portal state + intelligence engine */
export function computeClientReadinessIntel(state: PortalEventState): ClientReadinessIntel {
  const intel = runIntelligenceEngine();
  const portalSignals = intel.signals.filter(s => s.sourceAgent === 'client-readiness');

  const checklistPct =
    state.checklist.length === 0
      ? 0
      : (state.checklist.filter(c => c.complete).length / state.checklist.length) * 100;

  const paid = state.payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const paymentPct = Math.min(100, Math.round((paid / PORTAL_DEMO_EVENT.packageTotal) * 100));

  const agreementPct =
    state.agreementStatus === 'signed' ? 100 : state.agreementStatus === 'viewed' ? 55 : 20;

  const score = Math.round(
    checklistPct * 0.25 + paymentPct * 0.3 + agreementPct * 0.2 + intel.scores.eventReadiness * 0.25,
  );

  const label =
    score >= 80 ? 'On track' : score >= 55 ? 'Almost there' : 'Needs attention';

  const risks = portalSignals.map(s => s.summary);
  if (state.payments.some(p => p.status === 'due')) risks.push('Final balance due before event');
  if (!state.layoutChoice) risks.push('Layout preference not selected');

  const nextSteps = state.checklist.filter(c => !c.complete).map(c => c.label).slice(0, 4);

  return {
    score,
    label,
    factors: [
      { key: 'payments', label: 'Payments', pct: paymentPct },
      { key: 'agreement', label: 'Agreement', pct: agreementPct },
      { key: 'checklist', label: 'Checklist', pct: checklistPct },
      { key: 'ops', label: 'Venue readiness', pct: intel.scores.eventReadiness },
    ],
    conciergeSuggestions: intel.recommendations
      .filter(r => r.sourceAgent === 'client-readiness' || r.sourceAgent === 'revenue-lift')
      .map(r => r.headline)
      .slice(0, 4),
    nextSteps,
    risks,
  };
}

export function getVenueReadinessScores(): IntelligenceScores {
  return runIntelligenceEngine().scores;
}
