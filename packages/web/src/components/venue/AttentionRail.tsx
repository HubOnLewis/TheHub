import { Link } from 'react-router-dom';
import type { AttentionItem } from '../../venue/liveIntelligence.js';

const TONE: Record<AttentionItem['priority'], string> = {
  critical: 'venue-attention__item--critical',
  high: 'venue-attention__item--high',
  medium: 'venue-attention__item--medium',
  low: 'venue-attention__item--low',
};

type Props = {
  items: AttentionItem[];
  title?: string;
  max?: number;
};

export default function AttentionRail({ items, title = 'Needs attention', max = 6 }: Props) {
  const list = items.slice(0, max);
  if (list.length === 0) {
    return (
      <section className="venue-attention venue-attention--calm card">
        <header className="venue-attention__head">
          <h2>{title}</h2>
          <span className="venue-attention__badge venue-attention__badge--ok">Clear</span>
        </header>
        <p className="venue-attention__empty">
          No critical follow-ups or conflicts right now. Protect occupancy and keep proposals moving.
        </p>
      </section>
    );
  }

  return (
    <section className="venue-attention card">
      <header className="venue-attention__head">
        <h2>{title}</h2>
        <span className="venue-attention__badge">{items.length}</span>
      </header>
      <ul className="venue-attention__list">
        {list.map(item => (
          <li key={item.id} className={`venue-attention__item ${TONE[item.priority]}`}>
            <div className="venue-attention__body">
              <span className="venue-attention__agent">{item.agent}</span>
              <strong className="venue-attention__title">{item.title}</strong>
              <span className="venue-attention__detail">{item.detail}</span>
            </div>
            <Link to={item.href} className="btn btn-primary btn-sm">
              {item.actionLabel}
            </Link>
          </li>
        ))}
      </ul>
      {items.length > max ? (
        <p className="venue-attention__more text-muted text-sm">
          +{items.length - max} more — open Tasks or Activity for the full queue
        </p>
      ) : null}
    </section>
  );
}
