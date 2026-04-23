// packages/web/src/components/ui/MetricHeroCard.tsx
import React from 'react';

export type HeroTrend = 'up' | 'down' | 'neutral';

function TrendIcon({ trend }: { trend: HeroTrend }) {
  const stroke = 'currentColor';
  if (trend === 'up') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2" aria-hidden>
        <path d="M7 14l5-5 5 5M12 9v11" />
      </svg>
    );
  }
  if (trend === 'down') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2" aria-hidden>
        <path d="M7 10l5 5 5-5M12 15V4" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" aria-hidden>
      <path d="M5 12h14" />
    </svg>
  );
}

export function MetricHeroCard({
  label,
  value,
  sub,
  icon,
  trend = 'neutral',
  trendLabel,
  accent = 'default',
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon?: React.ReactNode;
  trend?: HeroTrend;
  trendLabel?: string;
  accent?: 'default' | 'danger' | 'warning' | 'success' | 'info';
}) {
  return (
    <div className={`metric-hero metric-hero--accent-${accent}`}>
      <div className="metric-hero__glow" aria-hidden />
      <div className="metric-hero__top">
        <span className="metric-hero__label">{label}</span>
        {icon && <span className="metric-hero__icon">{icon}</span>}
      </div>
      <div className="metric-hero__value">{value}</div>
      {(sub || trendLabel) && (
        <div className="metric-hero__footer">
          {sub && <span className="metric-hero__sub">{sub}</span>}
          {trendLabel && (
            <span className={`metric-hero__trend metric-hero__trend--${trend}`} title={trendLabel}>
              <TrendIcon trend={trend} />
            </span>
          )}
        </div>
      )}
    </div>
  );
}
