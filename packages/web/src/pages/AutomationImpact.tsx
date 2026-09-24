import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { VenueOpsKind } from '@hub-crm/shared';
import { ROUTES, opportunityDetailPath } from '../config/paths.js';
import { MiniBars } from '../components/executive/ExecutiveCharts.js';
import LoadingState from '../components/crm/LoadingState.js';
import { useLiveCrmEvents } from '../hooks/useLiveCrmEvents.js';
import { useVenueOpsQueue } from '../hooks/useVenueOps.js';
import { useVenueAttention } from '../hooks/useAgentSnapshot.js';
import { fetchAiStatus } from '../intelligence/ai/provider.js';

function kindLabel(kind: VenueOpsKind): string {
  switch (kind) {
    case 'stale_inquiry': return 'Stale inquiry';
    case 'hold_expiring':
    case 'hold_expired': return 'Hold';
    case 'walkthrough': return 'Walkthrough';
    case 'proposal_followup': return 'Proposal follow-up';
    case 'deposit_due': return 'Deposit';
    case 'balance_due': return 'Balance';
    case 'missing_details': return 'Missing details';
    case 'beo_missing': return 'BEO';
    case 'playbook_overdue': return 'Playbook';
    case 'prep': return 'Event prep';
    default: return kind;
  }
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function AutomationImpact() {
  const { rows, isLoading: rowsLoading } = useLiveCrmEvents();
  const queue = useVenueOpsQueue();
  const attention = useVenueAttention(rows);
  const aiStatus = useQuery({
    queryKey: ['ai', 'status'],
    queryFn: () => fetchAiStatus(false),
    staleTime: 30_000,
    retry: false,
  });

  const tasks = queue.data?.tasks ?? [];
  const byKind = useMemo(() => {
    const counts = new Map<VenueOpsKind, number>();
    for (const t of tasks) counts.set(t.kind, (counts.get(t.kind) ?? 0) + 1);
    return [...counts.entries()]
      .map(([kind, value]) => ({ label: kindLabel(kind), value }))
      .sort((a, b) => b.value - a.value);
  }, [tasks]);

  const snapshotDecisions = attention.snapshot?.decisions ?? [];
  const recentDecisions = [...snapshotDecisions]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 8);

  const isLoading = rowsLoading && queue.isLoading;
  if (isLoading) return <LoadingState message="Loading automation activity…" />;

  return (
    <div className="exec-page exec-page--automation">
      <div className="exec-page__glow exec-page__glow--emerald" aria-hidden />

      <header className="exec-page__hero">
        <div>
          <span className="exec-page__badge">The Hub Autopilot</span>
          <h1 className="exec-page__title">Automation activity</h1>
          <p className="exec-page__subtitle">
            Live recommendations, holds, and follow-ups the ops-queue engine is tracking right now — advisory only,
            staff approve every action.
          </p>
          <p className="exec-page__meta">
            {attention.source === 'api-agents' ? 'Persisted agent run' : 'Live rule evaluation'}
            {attention.snapshot?.generatedAt ? ` · last run ${formatWhen(attention.snapshot.generatedAt)}` : ''}
          </p>
        </div>
        <div className="exec-hero-kpis">
          <div className="exec-hero-kpi exec-hero-kpi--primary">
            <span className="exec-hero-kpi__label">Active recommendations</span>
            <span className="exec-hero-kpi__value">{tasks.length + attention.items.length}</span>
            <span className="exec-hero-kpi__sub">Ops-queue + agent findings, right now</span>
          </div>
          <div className="exec-hero-kpi">
            <span className="exec-hero-kpi__label">High priority</span>
            <span className="exec-hero-kpi__value">{queue.data?.summary?.high ?? 0}</span>
            <span className="exec-hero-kpi__sub">Needs action today</span>
          </div>
          <div className="exec-hero-kpi">
            <span className="exec-hero-kpi__label">Local AI</span>
            <span className="exec-hero-kpi__value" style={{ fontSize: 16 }}>
              {aiStatus.data ? (aiStatus.data.offline ? 'Offline' : aiStatus.data.reachable ? 'Connected' : 'Configured') : '—'}
            </span>
            <span className="exec-hero-kpi__sub">{aiStatus.data?.message ?? 'Advisory drafts only'}</span>
          </div>
        </div>
      </header>

      <div className="exec-layout-2">
        <section className="exec-panel exec-panel--layered">
          <div className="exec-panel__head">
            <h2>Open recommendations by type</h2>
            <span className="exec-panel__hint">Live ops-queue snapshot</span>
          </div>
          {byKind.length ? (
            <MiniBars items={byKind} />
          ) : (
            <p className="text-muted text-sm">Nothing open right now — the queue is clear.</p>
          )}
        </section>

        <section className="exec-panel exec-panel--chart">
          <div className="exec-panel__head">
            <h2>Recent decisions</h2>
            <Link to={ROUTES.autopilot} className="exec-panel__link-inline">
              Command center
            </Link>
          </div>
          {recentDecisions.length ? (
            <ul className="exec-highlight-list">
              {recentDecisions.map((d, i) => (
                <li key={`${d.findingId}-${i}`}>
                  <strong>{d.decision === 'approve' ? 'Approved' : 'Dismissed'}</strong>
                  <span>
                    {formatWhen(d.at)}
                    {d.by ? ` · ${d.by}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="exec-panel__foot">No recommendation decisions recorded yet.</p>
          )}
          <p className="exec-panel__foot">
            {tasks.length} open ops-queue item{tasks.length === 1 ? '' : 's'} · human-in-the-loop on every action
          </p>
        </section>
      </div>

      {attention.items.length ? (
        <section className="exec-panel">
          <div className="exec-panel__head">
            <h2>Current agent findings</h2>
            <span className="exec-panel__hint">{attention.items.length} open</span>
          </div>
          <ul className="exec-efficiency-list">
            {attention.items.slice(0, 8).map(item => (
              <li key={item.id}>
                <div className="exec-efficiency__head">
                  <strong>{item.title}</strong>
                  <span className="exec-efficiency__pct">{item.agent}</span>
                </div>
                <Link to={item.href} className="text-sm">
                  {item.detail}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tasks.length ? (
        <section className="exec-panel">
          <div className="exec-panel__head">
            <h2>Highest-priority open items</h2>
          </div>
          <ul className="exec-highlight-list">
            {tasks
              .filter(t => t.priority === 'high')
              .slice(0, 6)
              .map(t => (
                <li key={t.id}>
                  <strong>{t.title}</strong>
                  <Link to={opportunityDetailPath(t.dealId)} className="text-sm">
                    {t.contact} · {t.dueLabel}
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
