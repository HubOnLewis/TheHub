import type { IntelligenceScores } from '@hub-crm/shared';
import type { IntelligenceDataContext, NormalizedEvent } from '../context/types.js';
import { clampScore, ratioScore, weightedScore } from './framework.js';

function daysUntil(iso: string, asOf: string): number {
  const t = new Date(iso).getTime();
  const a = new Date(asOf).getTime();
  if (Number.isNaN(t)) return 999;
  return Math.ceil((t - a) / 86400000);
}

function eventPressure(e: NormalizedEvent, asOf: string): number {
  let p = 0;
  const d = daysUntil(e.eventDate, asOf);
  if (e.balanceDue > 0 && d < 14) p += 40;
  if (e.pvStatus === 'proposal_sent' && e.depositPaid === 0) p += 35;
  if (d < 7 && e.pvStatus === 'confirmed') p += 25;
  if (e.guests >= 80) p += 15;
  return clampScore(p);
}

export function computeIntelligenceScores(ctx: IntelligenceDataContext): IntelligenceScores {
  const pressures = ctx.events.map(e => eventPressure(e, ctx.asOf));
  const operationalPressure = pressures.length
    ? clampScore(pressures.reduce((a, b) => a + b, 0) / pressures.length)
    : 0;

  const confirmed = ctx.events.filter(e => e.pvStatus === 'confirmed' || e.pvStatus === 'balance_due');
  const readinessFactors = confirmed.map(e => {
    const dep = ratioScore(e.depositPaid, e.value);
    const bal = e.balanceDue > 0 ? 50 : 100;
    const prox = daysUntil(e.eventDate, ctx.asOf);
    const time = prox < 21 ? 40 : prox < 45 ? 70 : 90;
    return weightedScore([
      { value: dep, weight: 0.35 },
      { value: bal, weight: 0.35 },
      { value: time, weight: 0.3 },
    ]);
  });
  const eventReadiness = readinessFactors.length
    ? clampScore(readinessFactors.reduce((a, b) => a + b, 0) / readinessFactors.length)
    : 70;

  const healthy = ctx.events.filter(
    e => e.pvStatus === 'confirmed' || e.pvStatus === 'completed' || e.pvStatus === 'balance_due',
  ).length;
  const bookingHealth = ratioScore(healthy, ctx.events.length || 1);

  const proposals = ctx.events.filter(e => e.pvStatus === 'proposal_sent');
  const conversionProbability = proposals.length
    ? clampScore(
        proposals.reduce((s, e) => {
          const dep = e.depositPaid > 0 ? 75 : 45;
          return s + dep;
        }, 0) / proposals.length,
      )
    : 55;

  const staleInquiries = ctx.inquiries.filter(i => i.sla !== 'Met').length;
  const followUpUrgency = clampScore(40 + staleInquiries * 18 + ctx.tasks.filter(t => t.overdue).length * 12);

  const balanceExposure = ctx.events.reduce((s, e) => s + e.balanceDue, 0);
  const paymentRisk = clampScore(Math.min(100, balanceExposure / 15 + proposals.length * 8));

  const highGuestDays = ctx.events.filter(e => e.guests >= 75 && daysUntil(e.eventDate, ctx.asOf) < 10).length;
  const staffingPressure = clampScore(30 + highGuestDays * 22 + ctx.occupancyPct * 0.35);

  const openInquiries = ctx.inquiries.length;
  const clientEngagement = clampScore(55 + openInquiries * 5 - staleInquiries * 10);

  const kisiTasks = ctx.tasks.filter(t => t.title.includes('Kisi')).length;
  const automationConfidence = clampScore(70 + kisiTasks * 4 - ctx.tasks.filter(t => t.overdue).length * 15);

  return {
    operationalPressure,
    eventReadiness,
    bookingHealth,
    conversionProbability,
    followUpUrgency,
    paymentRisk,
    staffingPressure,
    clientEngagement,
    automationConfidence,
  };
}
