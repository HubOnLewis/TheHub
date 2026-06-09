import { formatCurrency } from '@hub-crm/shared';
import { ROUTES, opportunityDetailPath } from '../config/paths.js';
import type { OperationalRow } from '../components/operations/intel/OperationalRowList.js';
import {
  buildVenueCommandState,
  pressureRowHref,
  type VenueCommandExternal,
  type VenueCommandState,
} from './venueCommandState.js';

export type AttentionSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface CommandMetricView {
  id: string;
  group: 'money' | 'capacity' | 'workflow' | 'outlook';
  label: string;
  value: string;
  hint: string;
  warn?: boolean;
}

export interface AttentionItemView {
  id: string;
  href: string;
  severity: AttentionSeverity;
  severityLabel: string;
  headline: string;
  detail: string;
}

export interface FinancialSnapshotView {
  collected: string;
  outstanding: string;
  mtdCollected: string;
  proposalExposure: string;
  activeProposals: number;
  confirmedUpcoming: number;
  atRiskRevenue: string;
}

export interface DashboardViewModel {
  asOfLabel: string;
  suggestedAction: string;
  metrics: CommandMetricView[];
  attention: AttentionItemView[];
  totalPressureSignals: number;
  financial: FinancialSnapshotView;
  pressureRows: OperationalRow[];
}

function truncate(text: string, max = 72): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function severityFromItem(severity: 'high' | 'medium' | 'low'): AttentionSeverity {
  return severity === 'high' ? 'high' : severity === 'medium' ? 'medium' : 'low';
}

function parseAttention(text: string, id: string): AttentionItemView {
  const parts = text.split(' — ');
  const headline = parts[0] ?? text;
  const detail = parts.slice(1).join(' — ') || 'Open in pipeline';
  const isSeries = id.startsWith('series-');
  const critical = /outstanding|balance due|deposit/i.test(text) && !isSeries;
  const stale = /aging|stale|\d+d open/i.test(text);

  let severityLabel = 'Follow-up';
  if (critical) severityLabel = 'Balance due';
  else if (isSeries) severityLabel = 'Series';
  else if (stale) severityLabel = 'Stale proposal';

  return {
    id,
    href: pressureRowHref(id),
    severity: critical ? 'critical' : 'high',
    severityLabel,
    headline: truncate(headline, 52),
    detail: truncate(detail, 72),
  };
}

function buildSuggestedAction(cmd: VenueCommandState): string {
  if (cmd.approvals.pending > 0) {
    const n = cmd.approvals.pending;
    return `${n} outbound ${n === 1 ? 'item needs' : 'items need'} your approval before send.`;
  }
  const top = cmd.topPressureRows[0];
  if (top?.outstanding > 0) {
    return `Review balance for ${top.title} — ${formatCurrency(top.outstanding)} due, event in ${top.daysOut} days.`;
  }
  if (cmd.pressure.staleProposals > 0) {
    const n = cmd.pressure.staleProposals;
    return `${n} open proposal${n === 1 ? '' : 's'} past 14 days without deposit.`;
  }
  if (cmd.pressure.totalSignals === 0) {
    return 'No urgent revenue or prep items in the active pipeline.';
  }
  return 'Pipeline is stable — monitor confirmed events in Today view.';
}

function buildMetrics(cmd: VenueCommandState): CommandMetricView[] {
  return [
    {
      id: 'outstanding',
      group: 'money',
      label: 'Outstanding',
      value: formatCurrency(cmd.financials.outstandingOperational),
      hint: 'Active pipeline only · lost & archived excluded',
      warn: cmd.financials.outstandingOperational > 5000,
    },
    {
      id: 'collected',
      group: 'money',
      label: 'Collected',
      value: formatCurrency(cmd.financials.collected),
      hint: `MTD payments ${formatCurrency(cmd.financials.mtdCollected)}`,
    },
    {
      id: 'occupancy',
      group: 'capacity',
      label: 'Occupancy',
      value: `${cmd.occupancy.operational}%`,
      hint: `May · ${cmd.occupancy.bookedDays} booked days of ${cmd.occupancy.daysInMonth}`,
    },
    {
      id: 'approvals',
      group: 'workflow',
      label: 'Approvals',
      value: String(cmd.approvals.pending),
      hint: 'Awaiting review before send',
      warn: cmd.approvals.pending > 0,
    },
    {
      id: 'outlook',
      group: 'outlook',
      label: 'Health',
      value: `${cmd.aiOutlook.score}%`,
      hint: truncate(cmd.aiOutlook.explanation[0] ?? 'Composite venue health', 56),
    },
  ];
}

function buildPressureRows(cmd: VenueCommandState): OperationalRow[] {
  return cmd.topPressureRows.map(r => ({
    id: r.id,
    href: opportunityDetailPath(r.id),
    stage: r.status,
    stageTone: r.outstanding > 0 ? 'amber' : 'green',
    title: r.title,
    subtitle: r.client,
    meta: `${r.date} · ${r.daysOut} days${r.outstanding > 0 ? ` · ${formatCurrency(r.outstanding)} due` : ''}`,
    value: r.outstanding > 0 ? formatCurrency(r.outstanding) : formatCurrency(r.proposalTotal),
    progress: Math.min(98, r.pressureScore),
    urgency: r.pressureBucket === 'immediate_attention' ? 'critical' : 'high',
    aiHint:
      r.outstanding > 0
        ? `${formatCurrency(r.outstanding)} balance remaining`
        : 'Load-in & prep window',
    live: r.outstanding > 0,
    tags: r.outstanding > 0 ? ['Due'] : undefined,
  }));
}

export function buildDashboardViewModel(external: VenueCommandExternal): DashboardViewModel {
  const cmd = buildVenueCommandState(external);

  return {
    asOfLabel: `Today · ${cmd.asOf}`,
    suggestedAction: buildSuggestedAction(cmd),
    metrics: buildMetrics(cmd),
    attention: cmd.attentionItems.map(a => parseAttention(a.text, a.id)),
    totalPressureSignals: cmd.pressure.totalSignals,
    financial: {
      collected: formatCurrency(cmd.financials.collected),
      outstanding: formatCurrency(cmd.financials.outstandingOperational),
      mtdCollected: formatCurrency(cmd.financials.mtdCollected),
      proposalExposure: formatCurrency(cmd.financials.proposalExposure),
      activeProposals: cmd.pipeline.activeProposals,
      confirmedUpcoming: cmd.pipeline.confirmedUpcoming,
      atRiskRevenue: formatCurrency(cmd.pipeline.atRiskRevenue),
    },
    pressureRows: buildPressureRows(cmd),
  };
}
