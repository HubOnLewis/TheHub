import { Link } from 'react-router-dom';

export type IntelRowCell = {
  primary: string;
  secondary?: string;
  meta?: string;
};

export type VenueIntelRow = {
  id: string;
  href?: string;
  urgency?: 'critical' | 'high' | 'medium' | 'low';
  cells: IntelRowCell[];
  aiLine?: string;
  tags?: string[];
};

type Props = {
  title: string;
  columns: string[];
  rows: VenueIntelRow[];
  emptyMessage?: string;
};

function urgencyClass(u?: VenueIntelRow['urgency']) {
  if (!u) return '';
  return ` venue-intel-row--${u}`;
}

export default function VenueIntelRows({ title, columns, rows, emptyMessage }: Props) {
  return (
    <section className="venue-intel-panel">
      <header className="venue-intel-panel__head">
        <h2>{title}</h2>
        <span className="venue-intel-panel__count">{rows.length}</span>
      </header>
      <div className="venue-intel-table" role="table">
        <div className="venue-intel-table__row venue-intel-table__row--head" role="row">
          {columns.map(c => (
            <span key={c} role="columnheader">
              {c}
            </span>
          ))}
        </div>
        {rows.length === 0 ? (
          <p className="venue-intel-table__empty">{emptyMessage ?? 'No items'}</p>
        ) : (
          rows.map(row => {
            const inner = (
              <>
                {row.cells.map((cell, i) => (
                  <span key={i} className="venue-intel-table__cell" role="cell">
                    <strong>{cell.primary}</strong>
                    {cell.secondary ? <span className="venue-intel-table__sub">{cell.secondary}</span> : null}
                    {cell.meta ? <span className="venue-intel-table__meta">{cell.meta}</span> : null}
                  </span>
                ))}
              </>
            );
            const tags = row.tags?.length ? (
              <div className="venue-intel-row__tags">
                {row.tags.map(t => (
                  <span key={t} className="venue-intel-tag">
                    {t}
                  </span>
                ))}
              </div>
            ) : null;
            const ai = row.aiLine ? <p className="venue-intel-row__ai">{row.aiLine}</p> : null;
            const body = (
              <div className={`venue-intel-table__row venue-intel-table__row--data${urgencyClass(row.urgency)}`}>
                {inner}
                {tags}
                {ai}
              </div>
            );
            return row.href ? (
              <Link key={row.id} to={row.href} className="venue-intel-table__link">
                {body}
              </Link>
            ) : (
              <div key={row.id}>{body}</div>
            );
          })
        )}
      </div>
    </section>
  );
}
