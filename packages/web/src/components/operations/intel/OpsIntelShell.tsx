import type { ReactNode } from 'react';
import { OPS_DATA_SOURCE } from '../../../data/operationalIntelligence.js';

type Stat = { label: string; value: string; hint?: string; tone?: 'warn' | 'good' | 'neutral' };

type Props = {
  eyebrow?: string;
  title: string;
  subtitle: string;
  stats?: Stat[];
  actions?: ReactNode;
  children?: ReactNode;
};

export default function OpsIntelShell({ eyebrow = 'Venue operations', title, subtitle, stats, actions, children }: Props) {
  return (
    <header className="ops-intel-hero">
      <div className="ops-intel-hero__glow" aria-hidden />
      <div className="ops-intel-hero__top">
        <div>
          <span className="ops-intel-hero__eyebrow">{eyebrow}</span>
          <h1 className="page-title ops-intel-hero__title">{title}</h1>
          <p className="page-subtitle ops-intel-hero__sub">{subtitle}</p>
          <p className="ops-intel-hero__source">{OPS_DATA_SOURCE}</p>
        </div>
        {actions ? <div className="ops-intel-hero__actions">{actions}</div> : null}
      </div>
      {stats?.length ? (
        <div className="ops-intel-stat-strip">
          {stats.map(s => (
            <div
              key={s.label}
              className={`ops-intel-stat${s.tone === 'warn' ? ' ops-intel-stat--warn' : s.tone === 'good' ? ' ops-intel-stat--good' : ''}`}
            >
              <span className="ops-intel-stat__label">{s.label}</span>
              <strong className="ops-intel-stat__value">{s.value}</strong>
              {s.hint ? <span className="ops-intel-stat__hint">{s.hint}</span> : null}
            </div>
          ))}
        </div>
      ) : null}
      {children}
    </header>
  );
}
