/**
 * Unified CRM event rows — metrics, filtering, and display helpers.
 * Source resolution lives in crmEventSource.ts.
 */

import { formatCurrency, isHubContaminatedRecord } from '@hub-crm/shared';
import { mapDealToCrmRow } from './crmEventRowMappers.js';
import { ROUTES } from '../config/paths.js';
import { pvStatusDisplay, type PvEventStatus } from '../data/perfectVenueSeed.js';

export type CrmMetricCategory =
  | 'active'
  | 'lead'
  | 'qualified'
  | 'proposal_sent'
  | 'confirmed'
  | 'balance_due'
  | 'completed_ytd';

export interface CrmMetricCard {
  id: CrmMetricCategory;
  label: string;
  count: number;
  dollars: number;
}

export interface CrmEventRow {
  id: string;
  title: string;
  contact: string;
  status: string;
  statusLabel: string;
  pvStatus?: string;
  eventDate: string | null;
  eventDateDisplay: string;
  eventTime: string;
  guests: number;
  space: string;
  value: number;
  amountPaid?: number;
  balanceDue?: number;
  lastContacted: string | null;
  lastContactedDisplay: string;
  createdAt: string | null;
  createdDisplay: string;
  owner: string;
  ownerUserId?: string;
  href: string;
  source: 'api' | 'import';
}

const METRIC_LABELS: Record<CrmMetricCategory, string> = {
  active: 'Active Events',
  lead: 'Lead',
  qualified: 'Qualified',
  proposal_sent: 'Proposal Sent',
  confirmed: 'Confirmed',
  balance_due: 'Balance Due',
  completed_ytd: 'Completed YTD',
};

function mapPvStatusToCategory(status: PvEventStatus, balanceDue: number): CrmMetricCategory | null {
  if (status === 'completed') return 'completed_ytd';
  if (status === 'lost') return null;
  if (balanceDue > 0 || status === 'balance_due') return 'balance_due';
  if (status === 'lead') return 'lead';
  if (status === 'qualified') return 'qualified';
  if (status === 'proposal_sent') return 'proposal_sent';
  if (status === 'confirmed') return 'confirmed';
  return 'active';
}

function mapDealStatusToCategory(status: string): CrmMetricCategory | null {
  switch (status) {
    case 'Draft':
      return 'lead';
    case 'Pending Approval':
      return 'qualified';
    case 'Approved':
      return 'proposal_sent';
    case 'Won':
    case 'In Build':
      return 'confirmed';
    case 'Delivered':
      return 'completed_ytd';
    case 'Lost':
      return null;
    default:
      return 'active';
  }
}

export function rowMetricCategory(row: CrmEventRow): CrmMetricCategory | null {
  if (row.pvStatus) {
    return mapPvStatusToCategory(
      row.pvStatus as PvEventStatus,
      (row.balanceDue ?? 0) > 0 ? 1 : 0,
    );
  }
  if (row.source === 'api') return mapDealStatusToCategory(row.status);
  return mapPvStatusToCategory(row.status as PvEventStatus, row.status === 'balance_due' ? 1 : 0);
}

export function computeCrmMetrics(rows: CrmEventRow[]): CrmMetricCard[] {
  const cats: CrmMetricCategory[] = [
    'active',
    'lead',
    'qualified',
    'proposal_sent',
    'confirmed',
    'balance_due',
    'completed_ytd',
  ];
  const buckets = Object.fromEntries(
    cats.map(c => [c, { count: 0, dollars: 0 }]),
  ) as Record<CrmMetricCategory, { count: number; dollars: number }>;

  for (const row of rows) {
    const cat = rowMetricCategory(row);
    if (!cat || cat === 'active') continue;
    buckets[cat].count += 1;
    buckets[cat].dollars += row.value;
  }

  const activeRows = rows.filter(r => {
    const cat = rowMetricCategory(r);
    return cat != null && cat !== 'completed_ytd';
  });
  buckets.active = {
    count: activeRows.length,
    dollars: activeRows.reduce((s, r) => s + r.value, 0),
  };

  return cats.map(id => ({
    id,
    label: METRIC_LABELS[id],
    count: buckets[id].count,
    dollars: Math.round(buckets[id].dollars),
  }));
}

export function filterCrmRows(
  rows: CrmEventRow[],
  category: CrmMetricCategory | 'all',
  opts?: { mineOnly?: boolean; userId?: string; search?: string },
): CrmEventRow[] {
  let out = rows;
  if (category !== 'all') {
    if (category === 'active') {
      out = out.filter(r => {
        const cat = rowMetricCategory(r);
        return cat != null && cat !== 'completed_ytd';
      });
    } else {
      out = out.filter(r => rowMetricCategory(r) === category);
    }
  }
  if (opts?.mineOnly && opts.userId) {
    out = out.filter(
      r => r.ownerUserId === opts.userId || r.owner === opts.userId,
    );
  }
  if (opts?.search?.trim()) {
    const q = opts.search.trim().toLowerCase();
    out = out.filter(
      r =>
        r.title.toLowerCase().includes(q) ||
        r.contact.toLowerCase().includes(q) ||
        r.space.toLowerCase().includes(q),
    );
  }
  return out;
}

export function formatMetricDollars(n: number): string {
  return formatCurrency(n);
}

/** Exclude cross-tenant equipment/truck contamination; all other tenant deals are visible. */
export function isDealVisibleInWorkspace(d: Record<string, unknown>): boolean {
  const fields = {
    title: String(d.title ?? ''),
    company: String(d.company ?? ''),
    contact: String(d.contact ?? ''),
    notes: typeof d.notes === 'string' ? d.notes : undefined,
    unitId: typeof d.unitId === 'string' ? d.unitId : undefined,
    unitIds: Array.isArray(d.unitIds) ? (d.unitIds as string[]) : undefined,
    importMeta:
      d.importMeta && typeof d.importMeta === 'object'
        ? (d.importMeta as { source?: string })
        : undefined,
  };
  return !isHubContaminatedRecord(fields);
}

export function mapApiDealsToWorkspaceRows(deals: Array<Record<string, unknown>>): CrmEventRow[] {
  return deals.filter(isDealVisibleInWorkspace).map(mapDealToCrmRow);
}

export { METRIC_LABELS, ROUTES };

// Re-export row mappers for consumers that need them directly
export {
  mapDealToCrmRow,
  mapFullPvToRow,
  mapHubRefreshToRow,
  mapPfParsedToRow,
  mapDemoSeedToRow,
} from './crmEventRowMappers.js';
