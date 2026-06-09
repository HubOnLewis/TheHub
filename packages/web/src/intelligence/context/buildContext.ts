import {
  PV_PIPELINE_EVENTS,
  PV_RECENT_INQUIRIES,
  PV_TASKS,
  PV_VENUE_SUMMARY,
  isFullPvExportAvailable,
} from '../../data/perfectVenueSeed.js';
import { getFullPvEvents } from '../../data/pvDataLayer.js';
import { buildVenueCommandState } from '../../data/venueCommandState.js';
import type { IntelligenceDataContext } from './types.js';

const AS_OF = '2026-05-20T12:00:00.000Z';

export function buildIntelligenceContext(asOf = AS_OF): IntelligenceDataContext {
  const cmd = buildVenueCommandState({ pendingApprovals: 0 });
  return {
    asOf,
    venueId: 'hub-on-lewis',
    venueName: PV_VENUE_SUMMARY.venue,
    activeEventCount: cmd.pipeline.activePipelineCount,
    occupancyPct: cmd.occupancy.operational,
    events: isFullPvExportAvailable
      ? getFullPvEvents()
          .filter(e => !e.isExample && e.pvStatus !== 'lost')
          .slice(0, 120)
          .map(e => ({
            id: e.id,
            title: e.title,
            client: e.client,
            eventDate: e.eventDateIso ?? 'TBD',
            eventType: e.eventType,
            pvStatus: e.pvStatus,
            value: e.value,
            depositPaid: e.depositPaid,
            balanceDue: e.balanceDue,
            guests: e.guests,
            spaces: e.spaces.length ? e.spaces : e.space ? [e.space] : [],
          }))
      : PV_PIPELINE_EVENTS.map(e => ({
          id: e.id,
          title: e.title,
          client: e.client,
          eventDate: e.eventDate,
          eventType: e.eventType,
          pvStatus: e.pvStatus,
          value: e.value,
          depositPaid: e.depositPaid,
          balanceDue: e.balanceDue,
          guests: e.guests,
          spaces: e.spaces,
        })),
    tasks: PV_TASKS.map(t => ({
      id: t.id,
      title: t.title,
      client: t.client,
      linkedEvent: t.linkedEvent,
      priority: t.priority,
      daysUntil: t.daysUntil,
      overdue: t.overdue,
      automationSource: t.automationSource,
    })),
    inquiries: PV_RECENT_INQUIRIES.map(q => ({
      id: q.id,
      source: q.source,
      who: q.who,
      org: q.org,
      what: q.what,
      when: q.when,
      sla: q.sla,
    })),
  };
}
