/** Compact SVG microvisuals for executive pages */

export function MiniSparkline({
  values,
  color = 'var(--green)',
  width = 200,
  height = 48,
  id = 'spark',
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
  id?: string;
}) {
  const pad = 5;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = pad + (i / Math.max(1, values.length - 1)) * (width - 2 * pad);
      const y = pad + (1 - (v - min) / span) * (height - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const gradId = `fill-${id}`;
  return (
    <svg className="exec-mini-chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon fill={`url(#${gradId})`} points={`${pad},${height - pad} ${pts} ${width - pad},${height - pad}`} />
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" points={pts} />
    </svg>
  );
}

export function MiniBars({
  items,
  maxVal,
}: {
  items: Array<{ label: string; value: number; hint?: string }>;
  maxVal?: number;
}) {
  const max = maxVal ?? Math.max(...items.map(i => i.value), 1);
  return (
    <div className="exec-mini-bars">
      {items.map(item => (
        <div key={item.label} className="exec-mini-bars__row">
          <div className="exec-mini-bars__label">
            <span>{item.label}</span>
            {item.hint ? <span className="exec-mini-bars__hint">{item.hint}</span> : null}
          </div>
          <div className="exec-mini-bars__track" aria-hidden>
            <div className="exec-mini-bars__fill" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
          <span className="exec-mini-bars__val">{item.value}%</span>
        </div>
      ))}
    </div>
  );
}

export function DonutPct({ pct, size = 72, color = 'var(--green)' }: { pct: number; size?: number; color?: string }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  return (
    <svg width={size} height={size} className="exec-donut" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth="6" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" className="exec-donut__text">
        {pct}%
      </text>
    </svg>
  );
}
