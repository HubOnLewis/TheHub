import { useMemo, useState } from 'react';
import { formatCurrency, HUB_LABELS } from '@hub-crm/shared';
import DemoFlowNav from '../components/demo/DemoFlowNav.js';
import OpsIntelShell from '../components/operations/intel/OpsIntelShell.js';
import CommandPageFrame from '../components/operations/intel/CommandPageFrame.js';
import OpsFilterChips from '../components/operations/intel/OpsFilterChips.js';
import OperationalRowList, { type OperationalRow } from '../components/operations/intel/OperationalRowList.js';
import {
  getExecutiveRailSections,
  getOpportunityIntelligence,
  getPipelineSummaryStats,
  pvStatusDisplay,
} from '../data/operationalIntelligence.js';

export default function PipelinePressure() {
  const [stageFilter, setStageFilter] = useState('all');
  const stats = getPipelineSummaryStats();
  const all = useMemo(() => getOpportunityIntelligence(), []);
  const rail = useMemo(
    () => getExecutiveRailSections().filter(s => ['occupancy', 'automation', 'collisions', 'balances'].includes(s.id)),
    [],
  );

  const stages = useMemo(() => {
    const m = new Map<string, typeof all>();
    for (const o of all) {
      const k = pvStatusDisplay(o.event.pvStatus);
      m.set(k, [...(m.get(k) ?? []), o]);
    }
    return m;
  }, [all]);

  const stageKeys = [...stages.keys()];
  const activeStage = stageFilter === 'all' ? stageKeys[0] : stageFilter;
  const slice = stageFilter === 'all' ? all : (stages.get(stageFilter) ?? []);

  const rows: OperationalRow[] = slice.map(({ event, intel, link }) => ({
    id: event.id,
    href: link,
    stage: pvStatusDisplay(event.pvStatus),
    stageTone: intel.urgency === 'critical' ? 'rose' : intel.urgency === 'high' ? 'amber' : 'slate',
    title: event.title,
    subtitle: event.client,
    meta: intel.flags[0] ?? `${intel.daysUntilEvent}d to event`,
    value: formatCurrency(event.value),
    progress: intel.closeScore,
    urgency: intel.urgency,
    aiHint: intel.aiLine,
    live: intel.urgency !== 'low',
  }));

  return (
    <>
      <DemoFlowNav />
      <CommandPageFrame
        hero={
          <OpsIntelShell
            eyebrow="Venue execution map"
            title={HUB_LABELS.pipeline}
            subtitle="Operational execution by stage — revenue pressure, deposits, and approval bottlenecks."
            stats={[
              { label: 'Pipeline $', value: formatCurrency(stats.pipelineDollars) },
              { label: 'Balance due', value: formatCurrency(stats.balanceDue), tone: 'warn' },
              { label: 'Stages', value: String(stageKeys.length) },
            ]}
          />
        }
        filters={
          <OpsFilterChips
            chips={[
              { id: 'all', label: 'All stages', active: stageFilter === 'all' },
              ...stageKeys.map(k => ({
                id: k,
                label: k,
                active: stageFilter === k,
                count: stages.get(k)?.length,
              })),
            ]}
            onSelect={setStageFilter}
            aiHint={`Viewing ${stageFilter === 'all' ? activeStage : stageFilter} · ${slice.length} events`}
          />
        }
        railSections={rail}
      >
        {stageFilter === 'all'
          ? stageKeys.map(k => (
              <OperationalRowList
                key={k}
                title={`${k} · ${(stages.get(k) ?? []).length}`}
                rows={(stages.get(k) ?? []).map(({ event, intel, link }) => ({
                  id: event.id,
                  href: link,
                  title: event.title,
                  subtitle: event.client,
                  meta: intel.aiLine,
                  value: formatCurrency(event.value),
                  progress: intel.closeScore,
                  urgency: intel.urgency,
                }))}
              />
            ))
          : (
              <OperationalRowList title={`${stageFilter} queue`} rows={rows} dominant />
            )}
      </CommandPageFrame>
    </>
  );
}
