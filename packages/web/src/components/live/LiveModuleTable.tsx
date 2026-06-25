import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '@hub-crm/shared';
import StatusPill from '../crm/StatusPill.js';

type Column<T> = {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => React.ReactNode;
};

type Props<T> = {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  emptyTitle: string;
  emptyHint?: string;
};

export default function LiveModuleTable<T>({
  rows,
  columns,
  rowKey,
  emptyTitle,
  emptyHint,
}: Props<T>) {
  if (rows.length === 0) {
    return (
      <div className="card hub-live-empty">
        <p className="hub-live-empty__title">{emptyTitle}</p>
        {emptyHint ? <p className="text-muted text-sm">{emptyHint}</p> : null}
      </div>
    );
  }

  return (
    <div className="crm-events-table hub-live-table" role="table">
      <div className="crm-events-table__head" role="row">
        {columns.map(col => (
          <span
            key={col.key}
            className={`crm-events-table__col ${col.className ?? ''}`.trim()}
            role="columnheader"
          >
            {col.header}
          </span>
        ))}
      </div>
      {rows.map(row => (
        <div key={rowKey(row)} className="crm-events-table__row" role="row">
          {columns.map(col => (
            <span
              key={col.key}
              className={`crm-events-table__col ${col.className ?? ''}`.trim()}
              role="cell"
            >
              {col.render(row)}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export function EventLink({
  href,
  title,
  subtitle,
}: {
  href: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <Link to={href} className="hub-live-link">
      <strong>{title}</strong>
      {subtitle ? <span className="hub-live-link__sub">{subtitle}</span> : null}
    </Link>
  );
}

export function MoneyCell({ amount }: { amount: number }) {
  return <span>{formatCurrency(amount)}</span>;
}

export function StatusCell({ label, status }: { label: string; status?: string }) {
  return <StatusPill label={label} status={status} />;
}
