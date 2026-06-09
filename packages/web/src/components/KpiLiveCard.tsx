export type KpiTrendDir = 'up' | 'down' | 'flat';

export interface KpiLiveCardProps {
  label: string;
  value: string;
  sub: string;
  accent: string;
  trend?: { dir: KpiTrendDir; label: string };
  confidence?: number;
  pulse?: 'live' | 'warn' | 'none';
  microValues?: number[];
  className?: string;
}

function MicroTrendStrip({ values, accent }: { values: number[]; accent: string }) {
  const w = 56;
  const h = 22;
  const pad = 2;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = pad + (i / Math.max(1, values.length - 1)) * (w - 2 * pad);
      const y = pad + (1 - (v - min) / span) * (h - 2 * pad);
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg className="kpi-live-card__micro" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <polyline fill="none" stroke={accent} strokeWidth="1.5" strokeLinejoin="round" points={pts} opacity="0.85" />
    </svg>
  );
}

export default function KpiLiveCard({
  label,
  value,
  sub,
  accent,
  trend,
  confidence,
  pulse = 'none',
  microValues,
  className = '',
}: KpiLiveCardProps) {
  return (
    <article
      className={`kpi-live-card${pulse !== 'none' ? ` kpi-live-card--pulse-${pulse}` : ''}${className ? ` ${className}` : ''}`}
      style={{ ['--accent' as string]: accent }}
    >
      <div className="kpi-live-card__ambient" aria-hidden />
      <div className="kpi-live-card__top">
        <span className="kpi-live-card__label">{label}</span>
        {pulse === 'live' && <span className="kpi-live-card__live-dot" title="Live metric" />}
        {pulse === 'warn' && <span className="kpi-live-card__warn-dot" title="Needs attention" />}
      </div>
      <div className="kpi-live-card__value-row">
        <span className="kpi-live-card__value">{value}</span>
        {microValues && microValues.length > 1 ? <MicroTrendStrip values={microValues} accent={accent} /> : null}
      </div>
      <div className="kpi-live-card__footer">
        <span className="kpi-live-card__sub">{sub}</span>
        {trend ? (
          <span className={`kpi-live-card__trend kpi-live-card__trend--${trend.dir}`}>
            {trend.dir === 'up' ? '↑' : trend.dir === 'down' ? '↓' : '→'} {trend.label}
          </span>
        ) : null}
      </div>
      {typeof confidence === 'number' ? (
        <div className="kpi-live-card__confidence" title="Signal confidence">
          <div className="kpi-live-card__conf-track" aria-hidden>
            <div style={{ width: `${confidence}%` }} />
          </div>
          <span className="kpi-live-card__conf-label">{confidence}% signal</span>
        </div>
      ) : null}
    </article>
  );
}
