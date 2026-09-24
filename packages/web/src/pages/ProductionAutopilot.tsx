import { useAutopilotIntelligence } from '../hooks/useProductionIntelligence.js';

export default function ProductionAutopilot() {
  const q = useAutopilotIntelligence();

  if (q.isLoading) return <main className="page-simple"><div className="card page-section">Loading recommendations…</div></main>;
  if (q.isError) return <main className="page-simple"><div className="card page-section"><h1>AI Agents</h1><p>Live recommendations are temporarily unavailable.</p></div></main>;

  const d = q.data as any;
  const recommendations = d.recommendations || [];

  return (
    <main className="autopilot-page command-page">
      <header className="autopilot-hero command-hero">
        <div className="command-hero__inner">
          <div>
            <span className="autopilot-badge">Advisory intelligence</span>
            <h1 className="page-title">AI Agents</h1>
            <p className="page-subtitle">
              Recommendations derived from current Hub records. No actions execute automatically.
            </p>
          </div>
          <div className="autopilot-hero__summary" aria-label="Agent summary">
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
            {recommendations.map((x: any) => (
              <li key={x.id} className="autopilot-approval">
                <div className="autopilot-approval__title">{x.title}</div>
                <p className="autopilot-approval__proposed">{x.reason}</p>
                <div className="autopilot-approval__why">
                  <span>Source: {x.source}</span>
                  <span>Status: {x.status}</span>
                  <span>Target: {x.targetType} {x.targetId}</span>
                </div>
              </li>
            ))}
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
