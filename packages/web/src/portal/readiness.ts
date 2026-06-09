import type { PortalEventState } from './types.js';
import { PORTAL_DEMO_EVENT } from './demoData.js';
import { computeClientReadinessIntel } from '../intelligence/readiness/clientReadiness.js';

export interface ReadinessBreakdown {
  score: number;
  label: string;
  peaceHeadline: string;
  peaceDetail: string;
  risks: string[];
  factors: Array<{ key: string; label: string; pct: number; weight: number }>;
}

/** Rules-first readiness — intelligence engine + portal state (no LLM) */
export function computeReadiness(state: PortalEventState): ReadinessBreakdown {
  const intel = computeClientReadinessIntel(state);
  const checklistPct =
    state.checklist.length === 0
      ? 0
      : (state.checklist.filter(c => c.complete).length / state.checklist.length) * 100;

  const agreementPct =
    state.agreementStatus === 'signed' ? 100 : state.agreementStatus === 'viewed' ? 55 : 20;

  const paid = state.payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const paymentPct = Math.min(100, Math.round((paid / PORTAL_DEMO_EVENT.packageTotal) * 100));

  const guestPct = state.guestEstimateLocked ? 100 : state.guestCount > 0 ? 70 : 30;

  const layoutPct = state.layoutChoice ? 100 : 0;

  const logisticsPct = state.vendors.some(v => v.status === 'confirmed') ? 80 : 40;

  const factors = [
    { key: 'agreement', label: 'Agreement', pct: agreementPct, weight: 0.2 },
    { key: 'payments', label: 'Payments', pct: paymentPct, weight: 0.25 },
    { key: 'checklist', label: 'Checklist', pct: checklistPct, weight: 0.2 },
    { key: 'guests', label: 'Guest plan', pct: guestPct, weight: 0.15 },
    { key: 'layout', label: 'Layout', pct: layoutPct, weight: 0.1 },
    { key: 'logistics', label: 'Logistics', pct: logisticsPct, weight: 0.1 },
  ];

  const score = intel.score;

  const risks: string[] = [...intel.risks];
  if (!risks.length && state.payments.some(p => p.status === 'due')) risks.push('Final balance due before June 1');
  if (!state.guestEstimateLocked) risks.push('Guest count not locked for catering');
  if (!state.layoutChoice) risks.push('Layout preference not selected');
  if (state.agreementStatus !== 'signed') risks.push('Agreement awaiting signature');

  let label = 'On track';
  let peaceHeadline = "You're on track";
  let peaceDetail = 'Your coordinator has visibility on every milestone — nothing urgent needs attention right now.';

  if (score < 55) {
    label = 'Needs attention';
    peaceHeadline = 'A few items need you';
    peaceDetail = 'Complete the highlighted steps below to keep your event day effortless.';
  } else if (score < 80) {
    label = 'Almost there';
    peaceHeadline = 'Looking good — small steps left';
    peaceDetail = "You're close. Knock out the remaining checklist items at your pace.";
  }

  return { score, label, peaceHeadline, peaceDetail, risks, factors };
}
