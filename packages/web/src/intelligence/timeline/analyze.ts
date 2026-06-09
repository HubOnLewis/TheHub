import type { IntelligenceDataContext } from '../context/types.js';

export interface TimelineInsight {
  id: string;
  label: string;
  kind: 'payment' | 'proposal' | 'ops' | 'risk';
  at: string;
}

/** Deterministic timeline interpretation from PV event ordering */
export function analyzeTimeline(ctx: IntelligenceDataContext): TimelineInsight[] {
  const insights: TimelineInsight[] = [];
  const sorted = [...ctx.events].sort((a, b) => a.eventDate.localeCompare(b.eventDate));

  for (const e of sorted.slice(0, 12)) {
    if (e.pvStatus === 'proposal_sent') {
      insights.push({
        id: `tl-prop-${e.id}`,
        label: `Proposal path · ${e.title}`,
        kind: 'proposal',
        at: e.eventDate,
      });
    }
    if (e.balanceDue > 0) {
      insights.push({
        id: `tl-bal-${e.id}`,
        label: `Balance exposure · ${e.client}`,
        kind: 'payment',
        at: e.eventDate,
      });
    }
  }

  return insights.slice(0, 8);
}
