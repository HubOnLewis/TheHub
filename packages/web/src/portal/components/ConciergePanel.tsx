import { Link } from 'react-router-dom';
import { usePortalStore } from '../portalStore.js';

export default function ConciergePanel({ limit = 3 }: { limit?: number }) {
  const cards = usePortalStore(s => s.event.conciergeCards.filter(c => !c.dismissed).slice(0, limit));
  const dismiss = usePortalStore(s => s.dismissConcierge);

  if (cards.length === 0) return null;

  return (
    <section>
      <h3 className="portal-section-title">AI Concierge</h3>
      <p style={{ fontSize: 13, color: 'var(--portal-muted)', margin: '0 0 12px' }}>
        Calm planning guidance — not a chatbot. Recommendations update as your event evolves.
      </p>
      {cards.map(c => (
        <div key={c.id} className="portal-concierge-card">
          <strong>{c.headline}</strong>
          <p>
            <em>Because </em>
            {c.because}
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {c.actionRoute && c.actionLabel ? (
              <Link to={c.actionRoute} className="portal-btn portal-btn--secondary" style={{ fontSize: 12, padding: '6px 12px' }}>
                {c.actionLabel}
              </Link>
            ) : null}
            <button type="button" className="portal-btn portal-btn--ghost" style={{ fontSize: 12 }} onClick={() => dismiss(c.id)}>
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
