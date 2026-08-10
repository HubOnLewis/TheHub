import { Link } from 'react-router-dom';
import { ROUTES } from '../../config/paths.js';

type Props = {
  title?: string;
  hint?: string;
  actionLabel?: string;
  actionTo?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  secondaryActionTo?: string;
};

export default function EmptyState({
  title = 'No events match this filter',
  hint = 'Try another status card or clear filters.',
  actionLabel = 'Add event',
  actionTo = ROUTES.opportunities,
  onAction,
  secondaryActionLabel,
  secondaryActionTo,
}: Props) {
  return (
    <div className="crm-empty">
      <h3>{title}</h3>
      <p>{hint}</p>
      <div className="crm-empty__actions">
        {secondaryActionLabel && secondaryActionTo ? (
          <Link to={secondaryActionTo} className="btn btn-secondary btn-sm">
            {secondaryActionLabel}
          </Link>
        ) : null}
        {onAction ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={onAction}>
            {actionLabel}
          </button>
        ) : (
          <Link to={actionTo} className="btn btn-primary btn-sm">
            {actionLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
