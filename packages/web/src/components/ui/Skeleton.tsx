// packages/web/src/components/ui/Skeleton.tsx
import React from 'react';

export function SkeletonBlock({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton skeleton-block ${className}`.trim()} style={style} />;
}

export function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton" aria-busy aria-label="Loading dashboard">
      <div className="skeleton skeleton-line skeleton-line--lg" style={{ width: '40%', marginBottom: 20 }} />
      <div className="metric-hero-grid">
        {[1, 2, 3, 4].map(i => (
          <SkeletonBlock key={i} style={{ height: 132, borderRadius: 16 }} />
        ))}
      </div>
      <SkeletonBlock style={{ height: 48, marginTop: 28, marginBottom: 12, borderRadius: 12 }} />
      <SkeletonBlock style={{ height: 200, borderRadius: 16, marginBottom: 16 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <SkeletonBlock style={{ height: 280, borderRadius: 16 }} />
        <SkeletonBlock style={{ height: 280, borderRadius: 16 }} />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="table-skeleton" aria-busy aria-label="Loading table">
      <SkeletonBlock style={{ height: 40, borderRadius: 8, marginBottom: 8 }} />
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonBlock key={i} style={{ height: 48, borderRadius: 8, marginBottom: 6 }} />
      ))}
    </div>
  );
}
