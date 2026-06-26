import { formatCurrency } from '@hub-crm/shared';
import type { CrmMetricCard } from '../../lib/crmEvents.js';

type Props = {
  card: CrmMetricCard;
  selected: boolean;
  onSelect: () => void;
};

export default function MetricCard({ card, selected, onSelect }: Props) {
  return (
    <button
      type="button"
      className={`crm-metric-card${selected ? ' crm-metric-card--selected' : ''}`}
      data-metric={card.id}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className="crm-metric-card__badge">{card.count}</span>
      <span className="crm-metric-card__label">{card.label}</span>
      <span className="crm-metric-card__value">{formatCurrency(card.dollars)}</span>
    </button>
  );
}
