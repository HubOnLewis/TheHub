import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency, HUB_LABELS } from '@hub-crm/shared';
import { ROUTES } from '../../config/paths.js';
import { DEMO_PIPELINE, stageLabel, type DemoPipelineCard } from '../../data/demoVenue.js';

function stageTone(stage: DemoPipelineCard['stage']): string {
  switch (stage) {
    case 'confirmed':
    case 'fulfillment':
      return 'active-events__stage--green';
    case 'proposal':
      return 'active-events__stage--violet';
    case 'qualified':
      return 'active-events__stage--amber';
    default:
      return '';
  }
}

export default function ActiveEventsList() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <section className="active-events" aria-labelledby="active-events-heading">
      <header className="active-events__header">
        <h2 id="active-events-heading" className="active-events__title">
          Active events
        </h2>
        <Link to={ROUTES.opportunities} className="active-events__all">
          All {HUB_LABELS.opportunities.toLowerCase()}
        </Link>
      </header>

      <div className="active-events__table" role="table">
        <div className="active-events__row active-events__row--head" role="row">
          <span role="columnheader">Stage</span>
          <span role="columnheader">Event</span>
          <span role="columnheader">{HUB_LABELS.client}</span>
          <span role="columnheader">Date</span>
          <span role="columnheader" className="active-events__col--num">
            Value
          </span>
          <span role="columnheader" className="active-events__col--action" />
        </div>

        {DEMO_PIPELINE.map(card => {
          const open = expandedId === card.id;
          return (
            <div key={card.id} className="active-events__group">
              <button
                type="button"
                className={`active-events__row active-events__row--data${open ? ' active-events__row--open' : ''}`}
                onClick={() => setExpandedId(open ? null : card.id)}
                aria-expanded={open}
              >
                <span className={`active-events__stage ${stageTone(card.stage)}`} role="cell">
                  {stageLabel(card.stage)}
                </span>
                <span className="active-events__event" role="cell">
                  <strong>{card.title}</strong>
                  <span className="active-events__type">{card.eventType}</span>
                </span>
                <span className="active-events__client" role="cell">
                  {card.client}
                </span>
                <span className="active-events__date" role="cell">
                  {card.eventDate}
                </span>
                <span className="active-events__value active-events__col--num" role="cell">
                  {formatCurrency(card.value)}
                </span>
                <span className="active-events__chev active-events__col--action" aria-hidden>
                  {open ? '−' : '+'}
                </span>
              </button>
              {open ? (
                <div className="active-events__detail">
                  <span>{card.guests} guests · {card.spaces.join(' · ')}</span>
                  <span>
                    Deposit {formatCurrency(card.depositPaid)} · Balance{' '}
                    {formatCurrency(card.balanceDue)}
                  </span>
                  <Link to={`${ROUTES.opportunities}/${card.id}`} className="active-events__open">
                    Open workspace →
                  </Link>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
