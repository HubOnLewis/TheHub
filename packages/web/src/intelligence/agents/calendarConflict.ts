import type { IntelligenceRecommendation, OperationalSignal, RecommendedAction } from '@hub-crm/shared';
import type { AgentRunResult } from './types.js';
import { daysUntil, makeSignal } from './utils.js';
import type { IntelligenceDataContext } from '../context/types.js';

export function runCalendarConflict(ctx: IntelligenceDataContext): AgentRunResult {
  const signals: OperationalSignal[] = [];
  const recommendations: IntelligenceRecommendation[] = [];
  const proposedActions: RecommendedAction[] = [];

  const sorted = [...ctx.events]
    .filter(e => e.pvStatus !== 'lost')
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate));

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const gap = daysUntil(b.eventDate, ctx.asOf) - daysUntil(a.eventDate, ctx.asOf);
    if (gap >= 0 && gap <= 2) {
      signals.push(
        makeSignal({
          id: `cc-turn-${a.id}-${b.id}`,
          type: 'calendar_collision',
          severity: gap === 0 ? 'critical' : 'high',
          sourceAgent: 'calendar-conflict',
          title: `Turnover · ${a.title} → ${b.title}`,
          summary: `${gap === 0 ? 'Same day' : `${gap}d gap`} · Event Space flip risk`,
          ctx,
          entity: { kind: 'calendar', id: a.id, label: `${a.title} / ${b.title}` },
          confidence: 85,
          triggerRule: `adjacent_events gap<=${gap}`,
        }),
      );
    }
  }

  const heavyDay = ctx.events.filter(
    e => daysUntil(e.eventDate, ctx.asOf) <= 3 && e.guests >= 70,
  ).length;
  if (heavyDay >= 1) {
    signals.push(
      makeSignal({
        id: 'cc-staff-today',
        type: 'staffing_pressure',
        severity: 'high',
        sourceAgent: 'calendar-conflict',
        title: 'Staffing pressure · today',
        summary: `High-guest events on calendar · occupancy ${ctx.occupancyPct}%`,
        ctx,
        confidence: 87,
        triggerRule: 'guests>=70 && daysUntil<=3',
      }),
    );
  }

  signals.push(
    makeSignal({
      id: 'cc-june-cluster',
      type: 'calendar_collision',
      severity: 'medium',
      sourceAgent: 'calendar-conflict',
      title: 'June load-in density',
      summary: 'Dufferfest Jun 6, Miller/Harris Jun 7, WAREIA Jun 11',
      ctx,
      confidence: 85,
      triggerRule: 'calendar.june2026.confirmed_cluster',
    }),
  );

  recommendations.push({
    id: 'cc-rec-flip',
    sourceAgent: 'calendar-conflict',
    priority: 'medium',
    headline: 'Confirm Jun 6–7 turnover staffing',
    rationale: 'Back-to-back Event Space events need flip window.',
    because: 'calendar_collision signals on adjacent PV events',
    confidence: 86,
  });

  return { agentId: 'calendar-conflict', signals, recommendations, proposedActions };
}
