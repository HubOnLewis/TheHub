import { Link } from 'react-router-dom';

type Props = {
  eventId: string;
  detailHref: string;
  onDelete?: () => void;
  deleteLabel?: string;
};

export default function EventRowActions({
  eventId,
  detailHref,
  onDelete,
  deleteLabel = 'Archive',
}: Props) {
  return (
    <div className="crm-row-actions">
      <Link
        to={detailHref}
        className="crm-row-actions__btn"
        title="Edit event"
        aria-label={`Edit event ${eventId}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
        </svg>
      </Link>
      {onDelete ? (
        <button
          type="button"
          className="crm-row-actions__btn crm-row-actions__btn--danger"
          title={deleteLabel}
          aria-label={`${deleteLabel} event ${eventId}`}
          onClick={e => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          className="crm-row-actions__btn crm-row-actions__btn--danger"
          title={deleteLabel}
          aria-label={`${deleteLabel} event ${eventId}`}
          disabled
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
          </svg>
        </button>
      )}
    </div>
  );
}
