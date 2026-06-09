import { useMemo } from 'react';

export interface HeatDay {
  day: number;
  inMonth: boolean;
  intensity: 0 | 1 | 2 | 3 | 4;
  label?: string;
}

interface OccupancyHeatMapProps {
  days: HeatDay[];
  monthLabel: string;
}

const INTENSITY_CLASS: Record<number, string> = {
  0: 'heat-cell heat-cell--0',
  1: 'heat-cell heat-cell--1',
  2: 'heat-cell heat-cell--2',
  3: 'heat-cell heat-cell--3',
  4: 'heat-cell heat-cell--4',
};

export default function OccupancyHeatMap({ days, monthLabel }: OccupancyHeatMapProps) {
  const avg = useMemo(() => {
    const inMonth = days.filter(d => d.inMonth && d.intensity > 0);
    if (!inMonth.length) return 0;
    return Math.round((inMonth.reduce((s, d) => s + d.intensity, 0) / inMonth.length / 4) * 100);
  }, [days]);

  return (
    <div className="occupancy-heatmap">
      <div className="occupancy-heatmap__head">
        <span className="occupancy-heatmap__title">Utilization heat</span>
        <span className="occupancy-heatmap__month">{monthLabel}</span>
        <span className="occupancy-heatmap__avg">{avg}% stress index</span>
      </div>
      <div className="occupancy-heatmap__grid" role="img" aria-label={`Occupancy heat map for ${monthLabel}`}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
          <span key={d} className="heat-dow">{d}</span>
        ))}
        {days.map((cell, i) => (
          <span
            key={`${cell.day}-${i}`}
            className={`${INTENSITY_CLASS[cell.intensity]}${!cell.inMonth ? ' heat-cell--muted' : ''}`}
            title={cell.label ?? (cell.inMonth ? `Day ${cell.day}` : '')}
          >
            {cell.inMonth ? cell.day : ''}
          </span>
        ))}
      </div>
      <div className="occupancy-heatmap__legend">
        <span>Low</span>
        <span className="heat-legend-swatch heat-cell--1" />
        <span className="heat-legend-swatch heat-cell--2" />
        <span className="heat-legend-swatch heat-cell--3" />
        <span className="heat-legend-swatch heat-cell--4" />
        <span>High stress</span>
      </div>
    </div>
  );
}
