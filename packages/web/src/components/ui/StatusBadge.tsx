// packages/web/src/components/ui/StatusBadge.tsx
import React from 'react';

export type StatusTone = 'critical' | 'warning' | 'success' | 'info';

const TONE_CLASS: Record<StatusTone, string> = {
  critical: 'status-pill status-pill--critical',
  warning:  'status-pill status-pill--warning',
  success:  'status-pill status-pill--success',
  info:     'status-pill status-pill--info',
};

function dealTone(status: string): StatusTone {
  if (status === 'Lost') return 'critical';
  if (status === 'Pending Approval' || status === 'Draft') return 'warning';
  if (status === 'Delivered' || status === 'Won') return 'success';
  if (status === 'Approved' || status === 'In Build') return 'info';
  return 'info';
}

function buildTone(status: string): StatusTone {
  if (status === 'completed') return 'success';
  if (status === 'approved') return 'success';
  if (status === 'in_production') return 'info';
  if (status === 'quoted') return 'warning';
  if (status === 'draft') return 'warning';
  return 'info';
}

function productionTone(status: string): StatusTone {
  if (status === 'paused') return 'critical';
  if (status === 'completed') return 'success';
  if (status === 'in_progress') return 'info';
  if (status === 'ready') return 'warning';
  if (status === 'queued') return 'info';
  return 'info';
}

function deliveryTone(status: string): StatusTone {
  if (status === 'closed' || status === 'delivered') return 'success';
  if (status === 'ready_for_delivery' || status === 'scheduled') return 'warning';
  if (status === 'pending') return 'info';
  return 'info';
}

function marginRiskTone(level?: string): StatusTone {
  if (level === 'critical') return 'critical';
  if (level === 'high') return 'warning';
  if (level === 'medium') return 'warning';
  if (level === 'low') return 'success';
  return 'info';
}

export type StatusBadgeDomain = 'deal' | 'build' | 'production' | 'delivery' | 'marginRisk' | 'raw';

export function statusToneFor(
  domain: StatusBadgeDomain,
  value: string,
  extra?: { marginRiskLevel?: string },
): StatusTone {
  switch (domain) {
    case 'deal': return dealTone(value);
    case 'build': return buildTone(value);
    case 'production': return productionTone(value);
    case 'delivery': return deliveryTone(value);
    case 'marginRisk': return marginRiskTone(extra?.marginRiskLevel ?? value);
    case 'raw':
    default: return 'info';
  }
}

/** Colored pill for status text — semantic colors: critical / warning / success / info */
export function StatusBadge({
  children,
  tone,
  domain,
  value,
  className = '',
  style,
}: {
  children?: React.ReactNode;
  tone?: StatusTone;
  domain?: StatusBadgeDomain;
  value?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const v = value ?? (typeof children === 'string' ? children : '');
  const resolved: StatusTone =
    tone ?? (domain && v ? statusToneFor(domain, v) : 'info');
  const label = children ?? v;
  return (
    <span className={`${TONE_CLASS[resolved]} ${className}`.trim()} style={style}>{label}</span>
  );
}
