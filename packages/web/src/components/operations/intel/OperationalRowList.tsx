import { Link } from 'react-router-dom';

export type OperationalRow = {
  id: string;
  href?: string;
  stage?: string;
  stageTone?: 'green' | 'violet' | 'amber' | 'rose' | 'slate' | 'gold';
  title: string;
  subtitle?: string;
  meta?: string;
  value?: string;
  progress?: number;
  urgency?: 'critical' | 'high' | 'medium' | 'low';
  aiHint?: string;
  live?: boolean;
  tags?: string[];
};

type Props = {
  title: string;
  rows: OperationalRow[];
  linkAll?: { label: string; href: string };
  dominant?: boolean;
};

function stageClass(tone?: OperationalRow['stageTone']) {
  if (!tone) return 'ops-row__stage';
  return `ops-row__stage ops-row__stage--${tone}`;
}

export default function OperationalRowList({ title, rows, linkAll, dominant }: Props) {
  return (
    <section className={`ops-row-panel${dominant ? ' ops-row-panel--dominant' : ''}`}>
      <header className="ops-row-panel__head">
        <h2>{title}</h2>
        <span className="ops-row-panel__count">{rows.length}</span>
        {linkAll ? (
          <Link to={linkAll.href} className="ops-row-panel__all">
            {linkAll.label}
          </Link>
        ) : null}
      </header>
      <div className="ops-row-list">
        {rows.map(row => {
          const body = (
            <div className={`ops-row ops-row--${row.urgency ?? 'low'}`}>
              {row.live ? <span className="ops-row__live-dot" aria-label="Active" /> : null}
              {row.stage ? <span className={stageClass(row.stageTone)}>{row.stage}</span> : null}
              <div className="ops-row__main">
                <strong className="ops-row__title">{row.title}</strong>
                {row.subtitle ? <span className="ops-row__sub">{row.subtitle}</span> : null}
                {row.meta ? <span className="ops-row__meta">{row.meta}</span> : null}
              </div>
              {row.value ? <span className="ops-row__value">{row.value}</span> : null}
              {row.progress != null ? (
                <div className="ops-row__meter" title="Readiness / momentum">
                  <span style={{ width: `${row.progress}%` }} />
                </div>
              ) : null}
              {row.tags?.length ? (
                <div className="ops-row__tags">
                  {row.tags.map(t => (
                    <span key={t} className="ops-row__tag">
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
              {row.aiHint ? <p className="ops-row__ai">{row.aiHint}</p> : null}
            </div>
          );

          return row.href ? (
            <Link key={row.id} to={row.href} className="ops-row-link">
              {body}
            </Link>
          ) : (
            <div key={row.id} className="ops-row-link">
              {body}
            </div>
          );
        })}
      </div>
    </section>
  );
}
