import { Link } from 'react-router-dom';
import { ROUTES } from '../../config/paths.js';
import { EMPTY_LIVE_MESSAGE, isProductionCRM } from '../../config/productionData.js';
import type { AttentionItemView } from '../../lib/liveDataMappers.js';

type Props = {
  items: AttentionItemView[];
  totalSignals: number;
};

export default function AttentionQueue({ items, totalSignals }: Props) {
  return (
    <section className="attention-queue" aria-label="Attention queue">
      <header className="section-head">
        <div>
          <h2 className="section-head__title">Needs attention</h2>
          <p className="section-head__sub">
            Showing {items.length} of {totalSignals} active signals
          </p>
        </div>
        <Link to={ROUTES.opportunities} className="section-head__action">
          View pipeline
        </Link>
      </header>
      {items.length === 0 ? (
        <p className="attention-queue__empty">
          {isProductionCRM() ? EMPTY_LIVE_MESSAGE : 'Nothing requires immediate action in the active pipeline.'}
        </p>
      ) : (
        <ul className="attention-queue__list">
          {items.map(item => (
            <li key={item.id}>
              <Link
                to={item.href}
                className={`attention-queue__item attention-queue__item--${item.severity}`}
              >
                <span className="attention-queue__badge">{item.severityLabel}</span>
                <span className="attention-queue__headline">{item.headline}</span>
                <span className="attention-queue__detail">{item.detail}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
