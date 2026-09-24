import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { AiStatusResponse } from '@hub-crm/shared';
import { formatCurrency } from '@hub-crm/shared';
import client from '../api/client.js';
import { ROUTES } from '../config/paths.js';
import { useAutopilotIntelligence } from '../hooks/useProductionIntelligence.js';

function formatEventDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ProductionAutopilot() {
  const q = useAutopilotIntelligence();
  const ai = useQuery({
    queryKey: ['ai', 'status'],
    queryFn: () => client.get<AiStatusResponse>('/ai/status').then(r => r.data),
    staleTime: 30_000,
    retry: false,
  });
  const localConnected = Boolean(ai.data?.localNode?.connected);

  if (q.isLoading) return <main className="page-simple"><div className="card page-section">Loading recommendations…</div></main>;
  if (q.isError) return <main className="page-simple"><div className="card page-section"><h1>AI Agents</h1><p>Live recommendations are temporarily unavailable.</p></div></main>;

  const d = q.data as any;
  const recommendations = d.recommendations || [];

  return (
    <main className="autopilot-page command-page">
      <header className="autopilot-hero command-hero">
        <div className="command-hero__inner">
          <div>
            <span className="autopilot-badge">Advisory recommendations</span>
            <h1 className="page-title">AI Agents</h1>
            <p className="page-subtitle">
              Recommendations derived from current Hub records. No actions execute automatically.
            </p>
            <p className="text-sm text-muted" style={{ marginTop: 8 }}>
              Local AI:{' '}
              <strong>
                {ai.isLoading ? 'Checking…' : localConnected ? 'Connected' : 'Offline — awaiting heartbeat'}
              </strong>
            </p>
          </div>
          <div className="autopilot-hero__summary" aria-label="Recommendation summary">
            <span>Open recommendations</span>
            <strong>{recommendations.length}</strong>
            <small>Human approval remains required</small>
          </div>
        </div>
      </header>

      <section className="card autopilot-panel command-panel">
        <div className="autopilot-panel__head">
          <div>
            <span className="premium-data-card__kicker">Current advisory queue</span>
            <h2>Recommendations</h2>
          </div>
          <span className="autopilot-mini-hint">{recommendations.length} items</span>
        </div>

        {recommendations.length ? (
          <ul className="autopilot-approval-list">
            {recommendations.map((x: any) => {
              const eventHref = `${ROUTES.opportunities}/${x.targetId}`;
              const date = formatEventDate(x.eventDate);
              const money =
                x.balanceDue > 0
                  ? `${formatCurrency(x.balanceDue)} balance due`
                  : x.amount > 0
                    ? `${formatCurrency(x.amount)} proposal value`
                    : null;
              return (
                <li key={x.id} className="autopilot-approval">
                  <div className="autopilot-approval__title">
                    {x.eventTitle ? <Link to={eventHref}>{x.eventTitle}</Link> : x.title}
                  </div>
                  <p className="autopilot-approval__proposed">
                    {x.eventTitle ? `${x.title} — ` : ''}{x.reason}
                  </p>
                  <div className="autopilot-approval__why">
                    {date ? <span>Event date: {date}</span> : null}
                    {money ? <span>{money}</span> : null}
                    <Link to={eventHref}>Open event →</Link>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="hub-live-empty">
            <p className="hub-live-empty__title">No current recommendations</p>
            <p className="text-muted text-sm">The advisory queue is clear for the current Hub records.</p>
          </div>
        )}
      </section>
    </main>
  );
}
