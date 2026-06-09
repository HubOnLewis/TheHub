import type { SignalSeverity } from '@hub-crm/shared';
import type { OperationalSignal } from '@hub-crm/shared';

export interface RiskSummary {
  level: SignalSeverity;
  headline: string;
  count: number;
}

export function summarizeOperationalRisk(signals: OperationalSignal[]): RiskSummary[] {
  const bySeverity: Record<SignalSeverity, OperationalSignal[]> = {
    critical: [],
    high: [],
    medium: [],
    low: [],
  };
  for (const s of signals) {
    bySeverity[s.severity].push(s);
  }
  return (['critical', 'high', 'medium', 'low'] as SignalSeverity[])
    .filter(sev => bySeverity[sev].length > 0)
    .map(sev => ({
      level: sev,
      headline: `${bySeverity[sev].length} ${sev} signal${bySeverity[sev].length === 1 ? '' : 's'}`,
      count: bySeverity[sev].length,
    }));
}
