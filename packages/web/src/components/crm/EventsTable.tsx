import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '@hub-crm/shared';
import type { CrmEventRow } from '../../lib/crmEvents.js';
import StatusPill from './StatusPill.js';
import OwnerAvatar from './OwnerAvatar.js';
import EventRowActions from './EventRowActions.js';

type Props = {
  rows: CrmEventRow[];
  onDelete?: (id: string) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  showBulkSelect?: boolean;
};

function EventCard({
  row,
  onOpen,
  onDelete,
}: {
  row: CrmEventRow;
  onOpen: () => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <article className="crm-event-card" onClick={onOpen} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onOpen()}>
      <div className="crm-event-card__head">
        <div>
          <strong>{row.title}</strong>
          <span className="crm-event-card__contact">{row.contact}</span>
        </div>
        <StatusPill label={row.statusLabel} status={row.status} />
      </div>
      <div className="crm-event-card__meta">
        <span>{row.eventDateDisplay}</span>
        {row.eventTime ? <span>{row.eventTime}</span> : null}
        <span>{formatCurrency(row.value)}</span>
      </div>
      <div className="crm-event-card__actions" onClick={e => e.stopPropagation()}>
        <EventRowActions eventId={row.id} detailHref={row.href} onDelete={onDelete ? () => onDelete(row.id) : undefined} />
      </div>
    </article>
  );
}

export default function EventsTable({
  rows,
  onDelete,
  selectedIds,
  onToggleSelect,
  showBulkSelect = false,
}: Props) {
  const navigate = useNavigate();

  if (rows.length === 0) return null;

  return (
    <>
      <div className="crm-events-table" role="table" aria-label="Active events">
        <div className="crm-events-table__head" role="row">
          {showBulkSelect ? <span className="crm-events-table__col crm-events-table__col--check" role="columnheader" /> : null}
          <span className="crm-events-table__col crm-events-table__col--name" role="columnheader">Name</span>
          <span className="crm-events-table__col" role="columnheader">Status</span>
          <span className="crm-events-table__col" role="columnheader">Event Date</span>
          <span className="crm-events-table__col crm-events-table__col--num" role="columnheader">Size</span>
          <span className="crm-events-table__col" role="columnheader">Space</span>
          <span className="crm-events-table__col crm-events-table__col--num" role="columnheader">Value</span>
          <span className="crm-events-table__col" role="columnheader">Last Contacted</span>
          <span className="crm-events-table__col" role="columnheader">Created</span>
          <span className="crm-events-table__col crm-events-table__col--owner" role="columnheader">Owner</span>
          <span className="crm-events-table__col crm-events-table__col--actions" role="columnheader">Actions</span>
        </div>

        {rows.map(row => (
          <div
            key={row.id}
            className="crm-events-table__row"
            role="row"
            onClick={() => navigate(row.href)}
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && navigate(row.href)}
          >
            {showBulkSelect ? (
              <span className="crm-events-table__col crm-events-table__col--check" role="cell" onClick={e => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedIds?.has(row.id) ?? false}
                  onChange={() => onToggleSelect?.(row.id)}
                  aria-label={`Select ${row.title}`}
                />
              </span>
            ) : null}
            <span className="crm-events-table__col crm-events-table__col--name" role="cell">
              <strong>{row.title}</strong>
              <span className="crm-events-table__sub">{row.contact}</span>
            </span>
            <span className="crm-events-table__col" role="cell">
              <StatusPill label={row.statusLabel} status={row.status} />
            </span>
            <span className="crm-events-table__col" role="cell">
              <span>{row.eventDateDisplay}</span>
              {row.eventTime ? <span className="crm-events-table__sub">{row.eventTime}</span> : null}
            </span>
            <span className="crm-events-table__col crm-events-table__col--num" role="cell">
              {row.guests > 0 ? row.guests : <span className="crm-events-table__empty">—</span>}
            </span>
            <span className="crm-events-table__col" role="cell">
              {row.space || <span className="crm-events-table__empty">—</span>}
            </span>
            <span className="crm-events-table__col crm-events-table__col--num" role="cell">
              <span>{formatCurrency(row.value)}</span>
              {row.value > 0 ? <span className="crm-events-table__sub">Grand Total</span> : null}
            </span>
            <span className="crm-events-table__col" role="cell">
              {row.lastContactedDisplay}
            </span>
            <span className="crm-events-table__col" role="cell">
              {row.createdDisplay}
            </span>
            <span className="crm-events-table__col crm-events-table__col--owner" role="cell">
              <OwnerAvatar name={row.owner} />
            </span>
            <span className="crm-events-table__col crm-events-table__col--actions" role="cell" onClick={e => e.stopPropagation()}>
              <EventRowActions
                eventId={row.id}
                detailHref={row.href}
                onDelete={onDelete ? () => onDelete(row.id) : undefined}
              />
            </span>
          </div>
        ))}
      </div>

      <div className="crm-events-cards" aria-label="Active events">
        {rows.map(row => (
          <EventCard
            key={row.id}
            row={row}
            onOpen={() => navigate(row.href)}
            onDelete={onDelete}
          />
        ))}
      </div>
    </>
  );
}
