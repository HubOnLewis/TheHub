export interface LoadStripDay {
  id: string;
  label: string;
  sub: string;
  stress: 'normal' | 'elevated' | 'high';
  loadIn?: string;
  turnover?: string;
}

const STRESS_CLASS = {
  normal: 'load-strip-day',
  elevated: 'load-strip-day load-strip-day--elevated',
  high: 'load-strip-day load-strip-day--high',
};

interface OperationalLoadStripProps {
  days: LoadStripDay[];
}

export default function OperationalLoadStrip({ days }: OperationalLoadStripProps) {
  return (
    <div className="operational-load-strip">
      <header className="operational-load-strip__head">
        <h3>Operational load · next 7 days</h3>
        <span className="operational-load-strip__hint">Load-in windows & turnover</span>
      </header>
      <div className="operational-load-strip__row">
        {days.map(d => (
          <div key={d.id} className={STRESS_CLASS[d.stress]}>
            <span className="load-strip-day__label">{d.label}</span>
            <strong>{d.sub}</strong>
            {d.loadIn && <span className="load-strip-day__meta">Load-in · {d.loadIn}</span>}
            {d.turnover && <span className="load-strip-day__meta turnover">Turn · {d.turnover}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
