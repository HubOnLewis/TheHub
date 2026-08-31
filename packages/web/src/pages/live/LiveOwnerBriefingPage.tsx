import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '@hub-crm/shared';
import LoadingState from '../../components/crm/LoadingState.js';
import AttentionRail from '../../components/venue/AttentionRail.js';
import { useLiveCrmEvents } from '../../hooks/useLiveCrmEvents.js';
import { useAgentMutations, useVenueAttention } from '../../hooks/useAgentSnapshot.js';
import { buildOwnerBriefing } from '../../venue/liveIntelligence.js';
import { ROUTES } from '../../config/paths.js';
import { formatTodayLabel } from '../../config/productionData.js';

export default function LiveOwnerBriefingPage() {
  const { rows, isLoading, sourceId } = useLiveCrmEvents();
  const briefing = useMemo(() => buildOwnerBriefing(rows), [rows]);
  const { items, source, headline, summary, llmBriefing, snapshotQuery } = useVenueAttention(rows);
  const { evaluate } = useAgentMutations();

  const risks = items.filter(a => a.priority === 'critical' || a.priority === 'high').slice(0, 8);
  const opportunities = items
    .filter(a => a.agent === 'Follow-Up Hunter' || a.agent === 'Lead Concierge')
    .slice(0, 6);

  if (isLoading) return <LoadingState message="Building owner briefing…" />;

  return (
    <div className="hub-live-page owner-briefing-live">
      <header className="hub-admin-page__header owner-briefing-live__mast">
        <div>
          <p className="owner-briefing-live__eyebrow">{formatTodayLabel()} · Owner briefing</p>
          <h1 className="hub-admin-page__title">{headline || briefing.headline}</h1>
          <p className="hub-admin-page__subtitle">{summary || briefing.summary}</p>
          <p className="text-muted text-sm">
            Source: {sourceId === 'live-api' ? 'Live CRM' : 'Venue import'} · Agents:{' '}
            {source === 'api-agents' ? 'stored CRM snapshot' : 'live rules on current rows'} · Generated{' '}
            {new Date(briefing.generatedAt).toLocaleTimeString()}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={evaluate.isPending || snapshotQuery.isFetching}
            onClick={() => evaluate.mutate()}
          >
            {evaluate.isPending ? 'Refreshing…' : 'Refresh live agents'}
          </button>
          <Link to={ROUTES.calendar} className="btn btn-secondary btn-sm">
            Open calendar
          </Link>
        </div>
      </header>

      {llmBriefing ? (
        <section className="card owner-briefing-panel" style={{ marginBottom: 16 }}>
          <h2>Local model note</h2>
          <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{llmBriefing}</p>
          <p className="text-muted text-sm" style={{ marginTop: 8 }}>
            Draft only — not sent. Rules above remain the source of truth.
          </p>
        </section>
      ) : null}

      <div className="owner-briefing-live__kpis">
        {briefing.kpis.map(k => (
          <div
            key={k.label}
            className={`owner-briefing-kpi owner-briefing-kpi--${k.tone ?? 'neutral'}`}
          >
            <span>{k.label}</span>
            <strong>{k.value}</strong>
          </div>
        ))}
      </div>

      <div className="owner-briefing-live__grid">
        <AttentionRail items={risks} title="Risks & money at risk" max={8} />

        <section className="card owner-briefing-panel">
          <h2>Today on the floor</h2>
          {briefing.todayEvents.length === 0 ? (
            <p className="text-muted text-sm">No events dated today.</p>
          ) : (
            <ul className="owner-briefing-event-list">
              {briefing.todayEvents.map(e => (
                <li key={e.id}>
                  <Link to={e.href}>
                    <strong>{e.title}</strong>
                    <span>
                      {e.eventTime || 'Time TBD'} · {e.space || 'Space TBD'} · {e.guests || '?'} guests
                    </span>
                    <span className="text-muted">
                      {e.contact} · {formatCurrency(e.value)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card owner-briefing-panel">
          <h2>This week</h2>
          {briefing.weekEvents.length === 0 ? (
            <p className="text-muted text-sm">No upcoming events this week — fill the gaps.</p>
          ) : (
            <ul className="owner-briefing-event-list">
              {briefing.weekEvents.slice(0, 10).map(e => (
                <li key={e.id}>
                  <Link to={e.href}>
                    <strong>{e.title}</strong>
                    <span>
                      {e.eventDateDisplay} · {e.space || 'TBD'}
                    </span>
                    <span className="text-muted">{formatCurrency(e.value)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <AttentionRail items={opportunities} title="Follow-up opportunities" max={6} />
      </div>

      {briefing.conflicts.length > 0 ? (
        <section className="card owner-briefing-panel owner-briefing-panel--warn" style={{ marginTop: 16 }}>
          <h2>Hard calendar conflicts</h2>
          <ul className="owner-briefing-conflict-list">
            {briefing.conflicts.map(c => (
              <li key={c.id}>
                <strong>{c.dateKey}</strong> · {c.reason}{' '}
                <Link to={c.eventA.href}>Open {c.eventA.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
