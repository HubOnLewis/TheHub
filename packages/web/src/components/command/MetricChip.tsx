import type { CommandMetricView } from '../../data/buildDashboardViewModel.js';

type Props = {
  metric: CommandMetricView;
};

export default function MetricChip({ metric }: Props) {
  return (
    <div
      className={`metric-chip metric-chip--${metric.group}${metric.warn ? ' metric-chip--warn' : ''}`}
      title={metric.hint}
    >
      <span className="metric-chip__label">{metric.label}</span>
      <span className="metric-chip__value">{metric.value}</span>
    </div>
  );
}
