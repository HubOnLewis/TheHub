import { useMemo, useState } from 'react';
import { formatCurrency, HUB_LABELS } from '@hub-crm/shared';
import OpsIntelShell from '../components/operations/intel/OpsIntelShell.js';
import CommandPageFrame from '../components/operations/intel/CommandPageFrame.js';
import OpsFilterChips from '../components/operations/intel/OpsFilterChips.js';
import OperationalRowList, { type OperationalRow } from '../components/operations/intel/OperationalRowList.js';
import LoadingState from '../components/crm/LoadingState.js';
import { useLiveCrmEvents } from '../hooks/useLiveCrmEvents.js';
import { useVenueOpsQueue } from '../hooks/useVenueOps.js';
import { rowMetricCategory, METRIC_LABELS, type CrmMetricCategory, type CrmEventRow } from '../lib/crmEvents.js';
import { activePipelineRows, daysUntilEvent, getBalanceDue } from '../lib/liveEventHelpers.js';
import { opportunityDetailPath } from '../config/paths.js';
import type { ExecutiveRailSection } from '../data/operationalIntelligence.js';

const STAGE_ORDER: CrmMetricCategory[] = ['lead', 'proposal_sent', 'confirmed', 'balance_due'];

function stageToneFor(cat: CrmMetricCategory | null): OperationalRow['stageTone'] {
  if (cat === 'balance_due') return 'amber';
  if (cat === 'confirmed') return 'green';
  if (cat === 'proposal_sent') return 'violet';
  return 'slate';
}

function toRow(row: CrmEventRow, cat: CrmMetricCategory | null): OperationalRow {
  const days = daysUntilEvent(row);
  const balance = getBalanceDue(row);
  const meta =
    days != null ? `${days >= 0 ? `${days}d to event` : `${Math.abs(days)}d past event`}` : row.eventDateDisplay;
  return {
    id: row.id,
    href: row.href,
    stage: METRIC_LABELS[cat ?? 'active'],
    stageTone: stageToneFor(cat),
    title: row.title,
    subtitle: row.contact,
    meta: balance > 0 ? `${meta} · ${formatCurrency(balance)} due` : meta,
    value: formatCurrency(row.value),
    urgency: balance > 0 ? 'high' : days != null && days <= 7 && days >= 0 ? 'medium' : 'low',
    live: row.source === 'api',
  };
}

export default function PipelinePressure() {
  const [stageFilter, setStageFilter] = useState('all');
  const { rows, isLoading, isError } = useLiveCrmEvents();
  const queue = useVenueOpsQueue();

  const active = useMemo(() => activePipelineRows(rows), [rows]);

  const stages = useMemo(() => {
    const m = new Map<CrmMetricCategory, CrmEventRow[]>();
    for (const r of active) {
      let cat = rowMetricCategory(r);
      if (!cat || cat === 'active' || cat === 'completed_ytd') continue;
      if (cat === 'qualified') cat = 'lead';
      const list = m.get(cat) ?? [];
      list.push(r);
      m.set(cat, list);
    }
    return m;
  }, [active]);

  const stageKeys = STAGE_ORDER.filter(k => (stages.get(k)?.length ?? 0) > 0);
  const slice = stageFilter === 'all' ? active : (stages.get(stageFilter as CrmMetricCategory) ?? []);

  const pipelineDollars = active.reduce((s, r) => s + r.value, 0);
  const balanceDue = active.reduce((s, r) => s + getBalanceDue(r), 0);

  const rail: ExecutiveRailSection[] = useMemo(() => {
    const sections: ExecutiveRailSection[] = [];
    const topBalance = [...active]
      .filter(r => getBalanceDue(r) > 0)
      .sort((a, b) => getBalanceDue(b) - getBalanceDue(a))
      .slice(0, 4);
    if (topBalance.length) {
      sections.push({
        id: 'balances',
        title: 'Balance pressure',
        tone: 'warn',
        live: true,
        items: topBalance.map(r => ({
          id: r.id,
          label: `${r.title} · ${formatCurrency(getBalanceDue(r))}`,
          meta: r.contact,
          href: r.href,
        })),
      });
    }
    const highOps = (queue.data?.tasks ?? []).filter(t => t.priority === 'high').slice(0, 4);
    if (highOps.length) {
      sections.push({
        id: 'ops',
        title: 'High-priority ops',
        tone: 'gold',
        live: true,
        items: highOps.map(t => ({
          id: t.id,
          label: t.title,
          meta: `${t.contact} · ${t.dueLabel}`,
          href: opportunityDetailPath(t.dealId),
        })),
      });
    }
    return sections;
  }, [active, queue.data]);

  if (isLoading) return <LoadingState message="Loading pipeline…" />;

  return (
    <CommandPageFrame
      hero={
        <OpsIntelShell
          eyebrow="Venue execution map"
          title={HUB_LABELS.pipeline}
          subtitle="Live active events by stage — deposits, balances, and proposal follow-up."
          source={`Live · ${active.length} active events`}
          stats={[
            { label: 'Pipeline $', value: formatCurrency(pipelineDollars) },
            { label: 'Balance due', value: formatCurrency(balanceDue), tone: balanceDue > 0 ? 'warn' : 'good' },
            { label: 'Stages', value: String(stageKeys.length) },
          ]}
        />
      }
      filters={
        <OpsFilterChips
          chips={[
            { id: 'all', label: 'All stages', active: stageFilter === 'all', count: active.length },
            ...stageKeys.map(k => ({
              id: k,
              label: METRIC_LABELS[k],
              active: stageFilter === k,
              count: stages.get(k)?.length,
            })),
          ]}
          onSelect={setStageFilter}
          aiHint={`Viewing ${stageFilter === 'all' ? 'all stages' : METRIC_LABELS[stageFilter as CrmMetricCategory]} · ${slice.length} events`}
        />
      }
      railSections={rail.length ? rail : undefined}
    >
      {isError && !active.length ? (
        <div className="card hub-live-empty">
          <p className="hub-live-empty__title">Could not load live pipeline</p>
        </div>
      ) : active.length === 0 ? (
        <div className="card hub-live-empty">
          <p className="hub-live-empty__title">No active events in the pipeline</p>
          <p className="text-muted text-sm">Events appear here once an inquiry moves past lost/completed status.</p>
        </div>
      ) : stageFilter === 'all' ? (
        stageKeys.map(k => (
          <OperationalRowList
            key={k}
            title={`${METRIC_LABELS[k]} · ${(stages.get(k) ?? []).length}`}
            rows={(stages.get(k) ?? []).map(r => toRow(r, k))}
          />
        ))
      ) : (
        <OperationalRowList
          title={`${METRIC_LABELS[stageFilter as CrmMetricCategory] ?? stageFilter} queue`}
          rows={slice.map(r => toRow(r, rowMetricCategory(r)))}
          dominant
        />
      )}
    </CommandPageFrame>
  );
}
