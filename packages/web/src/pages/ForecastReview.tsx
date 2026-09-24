import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '@hub-crm/shared';
import OpsIntelShell from '../components/operations/intel/OpsIntelShell.js';
import CommandPageFrame from '../components/operations/intel/CommandPageFrame.js';
import ExecutiveRightRail from '../components/operations/intel/ExecutiveRightRail.js';
import OperationalRowList, { type OperationalRow } from '../components/operations/intel/OperationalRowList.js';
import LoadingState from '../components/crm/LoadingState.js';
import { useLiveCrmEvents } from '../hooks/useLiveCrmEvents.js';
import { useVenueOpsQueue } from '../hooks/useVenueOps.js';
import { useVenueAttention } from '../hooks/useAgentSnapshot.js';
import { buildLiveReportSummary, bookingCadence, getBalanceDue, daysUntilEvent } from '../lib/liveEventHelpers.js';
import { rowMetricCategory } from '../lib/crmEvents.js';
import { ROUTES, opportunityDetailPath } from '../config/paths.js';
import type { ExecutiveRailSection } from '../data/operationalIntelligence.js';

export default function ForecastReview() {
  const { rows, isLoading, isError } = useLiveCrmEvents();
  const queue = useVenueOpsQueue();
  const attention = useVenueAttention(rows);

  const report = useMemo(() => buildLiveReportSummary(rows), [rows]);
  const cadence = useMemo(() => bookingCadence(rows), [rows]);

  const opsTasks = queue.data?.tasks ?? [];
  const staleProposals = opsTasks.filter(t => t.kind === 'proposal_followup');
  const balanceExposureSoon = opsTasks.filter(t => t.kind === 'balance_due' || t.kind === 'deposit_due');
  const holdsExpiring = opsTasks.filter(t => t.kind === 'hold_expiring' || t.kind === 'hold_expired');
  const beoMissing = opsTasks.filter(t => t.kind === 'beo_missing');

  const confirmedValue =
    (report.metrics.find(m => m.id === 'confirmed')?.dollars ?? 0) +
    (report.metrics.find(m => m.id === 'balance_due')?.dollars ?? 0);

  const atRisk: OperationalRow[] = attention.items.slice(0, 8).map(f => ({
    id: f.id,
    href: f.href,
    stage: f.agent,
    stageTone: 'rose' as const,
    title: f.title,
    subtitle: f.eventTitle,
    meta: f.detail,
    value: f.amount != null ? formatCurrency(f.amount) : undefined,
    urgency: f.priority === 'critical' ? 'critical' : f.priority,
    live: true,
  }));

  const commitRows: OperationalRow[] = rows
    .filter(r => {
      const cat = rowMetricCategory(r);
      return cat === 'confirmed' || cat === 'balance_due';
    })
    .slice(0, 6)
    .map(r => {
      const days = daysUntilEvent(r);
      return {
        id: `c-${r.id}`,
        href: r.href,
        stage: 'Booked',
        stageTone: 'green' as const,
        title: r.title,
        subtitle: r.contact,
        meta: days != null ? `${days}d to event` : undefined,
        value: formatCurrency(r.value),
        live: r.source === 'api',
      };
    });

  const rail: ExecutiveRailSection[] = useMemo(() => {
    const sections: ExecutiveRailSection[] = [];
    if (report.balanceDueRows.length) {
      sections.push({
        id: 'balance-exposure',
        title: 'Balance exposure',
        tone: 'warn',
        live: true,
        items: report.balanceDueRows.slice(0, 4).map(r => ({
          id: r.id,
          label: `${r.title} · ${formatCurrency(getBalanceDue(r))}`,
          meta: r.contact,
          href: r.href,
        })),
      });
    }
    if (staleProposals.length) {
      sections.push({
        id: 'stale-proposals',
        title: 'Proposal follow-up',
        tone: 'gold',
        items: staleProposals.slice(0, 4).map(t => ({
          id: t.id,
          label: t.eventTitle,
          meta: `${t.dueLabel} · ${formatCurrency(t.value)}`,
          href: opportunityDetailPath(t.dealId),
        })),
      });
    }
    if (report.upcomingByMonth.length) {
      sections.push({
        id: 'booking-cadence',
        title: 'Bookings created (8 wks)',
        tone: 'neutral',
        live: true,
        spark: cadence,
        items: report.upcomingByMonth.slice(0, 3).map(m => ({
          id: m.month,
          label: m.month,
          meta: `${m.count} events · ${formatCurrency(m.value)}`,
        })),
      });
    }
    return sections;
  }, [report, staleProposals, cadence]);

  const decisionPoints: string[] = [
    staleProposals.length
      ? `${staleProposals.length} proposal${staleProposals.length === 1 ? '' : 's'} awaiting follow-up · ${formatCurrency(staleProposals.reduce((s, t) => s + t.value, 0))} at stake`
      : 'No proposals currently overdue for follow-up',
    balanceExposureSoon.length
      ? `${balanceExposureSoon.length} event${balanceExposureSoon.length === 1 ? '' : 's'} with deposit/balance due · ${formatCurrency(balanceExposureSoon.reduce((s, t) => s + t.balanceDue, 0))} exposure`
      : 'No open deposit or balance collection items',
    holdsExpiring.length
      ? `${holdsExpiring.length} inquiry hold${holdsExpiring.length === 1 ? '' : 's'} expiring or expired — release or convert`
      : 'No holds expiring soon',
    beoMissing.length
      ? `${beoMissing.length} upcoming confirmed event${beoMissing.length === 1 ? '' : 's'} missing a staff BEO`
      : 'All near-term confirmed events have a staff BEO on file',
  ];

  if (isLoading) return <LoadingState message="Loading forecast…" />;

  return (
    <CommandPageFrame
      hero={
        <OpsIntelShell
          eyebrow="Decision support"
          title="Forecast & Readiness"
          subtitle="Live pipeline value, balance exposure, and booking cadence — operational readiness, not a predictive model."
          source={`Live · ${rows.length} events`}
          stats={[
            { label: 'Active pipeline', value: formatCurrency(report.activePipelineValue) },
            { label: 'Confirmed & booked', value: formatCurrency(confirmedValue), tone: 'good' },
            { label: 'At risk', value: String(atRisk.length), tone: atRisk.length > 0 ? 'warn' : 'good' },
          ]}
        />
      }
      rail={rail.length ? <ExecutiveRightRail sections={rail} /> : undefined}
    >
      {isError && !rows.length ? (
        <div className="card hub-live-empty">
          <p className="hub-live-empty__title">Could not load live forecast data</p>
        </div>
      ) : (
        <>
          <div className="insights-command-grid">
            <article className="insights-narrative">
              <h2>Readiness — what needs a decision</h2>
              <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>
                Live decision points
              </h3>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                {decisionPoints.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ol>
              <Link to={ROUTES.ownerBriefing} className="btn btn-secondary btn-sm" style={{ marginTop: 14 }}>
                Owner briefing →
              </Link>
            </article>
            <div>
              <OperationalRowList title="Revenue at risk" rows={atRisk} />
            </div>
          </div>
          <OperationalRowList
            title="Commit & confirmed path"
            rows={commitRows}
            linkAll={{ label: 'Pipeline →', href: ROUTES.pipeline }}
          />
        </>
      )}
    </CommandPageFrame>
  );
}
