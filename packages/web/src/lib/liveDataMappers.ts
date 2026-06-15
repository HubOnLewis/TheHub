import { formatCurrency } from '@hub-crm/shared';
import { ROUTES, opportunityDetailPath } from '../config/paths.js';
import type { OperationalRow } from '../components/operations/intel/OperationalRowList.js';
import type { DashboardStats } from '../hooks/useDashboard.js';
import { daysSince, formatRelativeDate } from '../config/productionData.js';

export type AttentionSeverity = 'critical' | 'high' | 'medium' | 'low';

export type AttentionItemView = {
  id: string;
  href: string;
  severity: AttentionSeverity;
  severityLabel: string;
  headline: string;
  detail: string;
};

export type LiveFinancialSnapshot = {
  collected: string;
  outstanding: string;
  activeProposals: number;
  confirmedUpcoming: number;
};

type StatusRow = { _id: string; count: number; totalAmount?: number };

function sumStatus(rows: StatusRow[] | undefined, statuses: string[]): number {
  if (!rows) return 0;
  return rows.filter(r => statuses.includes(r._id)).reduce((n, r) => n + r.count, 0);
}

function sumDealAmount(rows: DashboardStats['dealsByStatus'], statuses: string[]): number {
  if (!rows) return 0;
  return rows.filter(r => statuses.includes(r._id)).reduce((n, r) => n + (r.totalAmount ?? 0), 0);
}

export function buildLiveFinancialSnapshot(stats: DashboardStats | undefined): LiveFinancialSnapshot {
  const deals = stats?.dealsByStatus ?? [];
  const leads = stats?.leadsByStatus ?? [];
  return {
    collected: formatCurrency(sumDealAmount(deals, ['Won', 'Delivered', 'In Build'])),
    outstanding: formatCurrency(sumDealAmount(deals, ['Draft', 'Pending Approval', 'Approved', 'Won', 'In Build'])),
    activeProposals: sumStatus(leads, ['Quoted']) + sumStatus(deals, ['Draft', 'Pending Approval']),
    confirmedUpcoming: sumStatus(deals, ['Approved', 'Won', 'In Build']),
  };
}

export function buildLiveSuggestedAction(
  stats: DashboardStats | undefined,
  leadTotal: number,
  dealTotal: number,
): string {
  if (leadTotal === 0 && dealTotal === 0) {
    return 'No live records found yet — add leads or events to get started.';
  }
  if ((stats?.criticalDeals ?? 0) > 0) {
    return `Review ${stats!.criticalDeals} critical event(s) first.`;
  }
  if ((stats?.followUpOverdueOpen ?? 0) > 0) {
    return `Clear ${stats!.followUpOverdueOpen} overdue follow-up(s).`;
  }
  if ((stats?.staleLeads?.total ?? 0) > 0) {
    return `Work ${stats!.staleLeads!.total} stale lead(s) in the queue.`;
  }
  return 'Review open leads and active events.';
}

export function buildLiveAttentionItems(stats: DashboardStats | undefined): AttentionItemView[] {
  const items: AttentionItemView[] = [];
  if ((stats?.criticalDeals ?? 0) > 0) {
    items.push({
      id: 'critical-deals',
      href: ROUTES.opportunities,
      severity: 'critical',
      severityLabel: 'Critical',
      headline: `${stats!.criticalDeals} critical event(s)`,
      detail: 'Pipeline pressure needs review',
    });
  }
  if ((stats?.followUpOverdueOpen ?? 0) > 0) {
    items.push({
      id: 'overdue-followups',
      href: ROUTES.leads,
      severity: 'high',
      severityLabel: 'Overdue',
      headline: `${stats!.followUpOverdueOpen} overdue follow-up(s)`,
      detail: 'Open leads queue to clear items',
    });
  }
  if ((stats?.staleLeads?.total ?? 0) > 0) {
    items.push({
      id: 'stale-leads',
      href: ROUTES.leads,
      severity: 'medium',
      severityLabel: 'Stale',
      headline: `${stats!.staleLeads!.total} stale lead(s)`,
      detail: 'No recent touch on open inquiries',
    });
  }
  if ((stats?.unassignedLeads ?? 0) > 0) {
    items.push({
      id: 'unassigned-leads',
      href: ROUTES.leads,
      severity: 'medium',
      severityLabel: 'Unassigned',
      headline: `${stats!.unassignedLeads} unassigned lead(s)`,
      detail: 'Assign owners to keep SLAs',
    });
  }
  return items;
}

export function mapLeadToOperationalRow(lead: Record<string, unknown>): OperationalRow {
  const id = String(lead._id ?? '');
  const status = String(lead.status ?? 'New');
  const updatedAt = lead.updatedAt as string | undefined;
  const age = daysSince(updatedAt);
  const stale = age != null && age >= 3;
  const urgency =
    status === 'New' && stale ? 'high' : status === 'Quoted' ? 'medium' : stale ? 'medium' : 'low';

  return {
    id,
    stage: status,
    stageTone: urgency === 'high' ? 'rose' : status === 'Quoted' ? 'violet' : 'amber',
    title: String(lead.contact ?? 'Contact'),
    subtitle: String(lead.company ?? ''),
    meta: `${lead.source ? `${String(lead.source)} · ` : ''}Updated ${formatRelativeDate(updatedAt)}`,
    value: status,
    progress: status === 'Quoted' ? 55 : status === 'New' ? 30 : 65,
    urgency,
    live: urgency === 'high',
    tags: urgency === 'high' ? ['Needs attention'] : undefined,
  };
}

export function mapDealToOperationalRow(deal: Record<string, unknown>): OperationalRow {
  const id = String(deal._id ?? '');
  const status = String(deal.status ?? 'Draft');
  const amount = typeof deal.amount === 'number' ? deal.amount : 0;
  const updatedAt = deal.updatedAt as string | undefined;
  const exec = deal.dealExecutionState as { pressureLevel?: string; isStalled?: boolean } | undefined;
  const pressure = exec?.pressureLevel;
  const urgency =
    pressure === 'critical' ? 'critical' : pressure === 'high' ? 'high' : exec?.isStalled ? 'medium' : 'low';

  return {
    id,
    href: opportunityDetailPath(id),
    stage: status,
    stageTone: urgency === 'critical' || urgency === 'high' ? 'rose' : status === 'Approved' || status === 'Won' ? 'green' : 'amber',
    title: String(deal.title ?? 'Event'),
    subtitle: String(deal.company ?? ''),
    meta: `Updated ${formatRelativeDate(updatedAt)}`,
    value: formatCurrency(amount),
    progress: status === 'Delivered' ? 100 : status === 'In Build' ? 80 : status === 'Won' ? 70 : 45,
    urgency,
    live: urgency === 'critical' || urgency === 'high',
    tags: exec?.isStalled ? ['Stale'] : pressure === 'critical' ? ['Critical'] : undefined,
  };
}

export function countLiveLeadFilter(
  leads: Array<Record<string, unknown>>,
  filter: string,
): number {
  return leads.filter(l => matchesLeadFilter(l, filter)).length;
}

export function matchesLeadFilter(lead: Record<string, unknown>, filter: string): boolean {
  const status = String(lead.status ?? '');
  const age = daysSince(lead.updatedAt as string | undefined);
  if (filter === 'urgent') return status === 'New' && (age ?? 0) >= 3;
  if (filter === 'proposal') return status === 'Quoted';
  if (filter === 'stalled') return (status === 'Working' || status === 'Contacted') && (age ?? 0) >= 7;
  return status !== 'Converted' && status !== 'Lost';
}

export function matchesDealFilter(deal: Record<string, unknown>, filter: string): boolean {
  const status = String(deal.status ?? '');
  if (status === 'Lost' || status === 'Delivered') return false;
  const age = daysSince(deal.updatedAt as string | undefined);
  const exec = deal.dealExecutionState as { pressureLevel?: string; isStalled?: boolean } | undefined;
  if (filter === 'balance') return ['Approved', 'Won'].includes(status);
  if (filter === 'approaching') return ['Approved', 'Won', 'In Build'].includes(status);
  if (filter === 'stale') return exec?.isStalled === true || (age ?? 0) >= 14;
  return true;
}

export function countDealPressure(deals: Array<Record<string, unknown>>): number {
  return deals.filter(d => {
    const exec = d.dealExecutionState as { pressureLevel?: string; isStalled?: boolean } | undefined;
    return exec?.pressureLevel === 'critical' || exec?.pressureLevel === 'high' || exec?.isStalled;
  }).length;
}