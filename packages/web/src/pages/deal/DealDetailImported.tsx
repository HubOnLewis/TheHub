import { Link } from 'react-router-dom';
import { formatCurrency } from '@hub-crm/shared';
import { ROUTES } from '../../config/paths.js';
import { getFullPvEventById, getFullPvProposal } from '../../data/pvDataLayer.js';
import { pvStatusDisplay } from '../../data/perfectVenueSeed.js';

type Props = { dealId: string };

export default function DealDetailImported({ dealId }: Props) {
  const event = getFullPvEventById(dealId);
  if (!event) return null;

  const proposal = getFullPvProposal(dealId);
  const proposalTotal = proposal?.total ?? event.proposalTotal ?? 0;
  const balanceDue = event.balanceDue ?? 0;

  return (
    <div className="deal-flagship-page command-page hub-demo-deal-page">
      <div style={{ marginBottom: 16 }}>
        <Link to={ROUTES.opportunities} className="btn btn-ghost" style={{ fontSize: 12 }}>
          ← Events
        </Link>
      </div>

      <header className="flagship-hero flagship-hero--cinematic hub-demo-deal-hero">
        <div>
          <span className="ai-chip">Event</span>
          <h1>{event.title}</h1>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Client: <strong style={{ color: 'var(--text-primary)' }}>{event.client}</strong>
            {event.eventDate ? ` · Event date ${event.eventDate}` : ''}
          </div>
        </div>

        <div className="flagship-grid" style={{ marginTop: 22 }}>
          <div className="flagship-stat">
            <div className="flagship-stat__label">Status</div>
            <div className="flagship-stat__value" style={{ fontSize: 15 }}>
              {pvStatusDisplay(event.pvStatus)}
            </div>
          </div>
          <div className="flagship-stat">
            <div className="flagship-stat__label">Proposal value</div>
            <div className="flagship-stat__value">{formatCurrency(proposalTotal)}</div>
          </div>
          <div className="flagship-stat">
            <div className="flagship-stat__label">Balance due</div>
            <div className="flagship-stat__value">{formatCurrency(balanceDue)}</div>
          </div>
          <div className="flagship-stat">
            <div className="flagship-stat__label">Guests</div>
            <div className="flagship-stat__value">{event.guests ?? '—'}</div>
          </div>
        </div>
      </header>

      <p className="text-sm text-muted deal-tech-meta" style={{ marginTop: 16 }}>
        Event reference · {dealId}
      </p>
    </div>
  );
}