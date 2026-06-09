/** Shared scoring math (server-side parity with web) */
export function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function weightedScore(factors: Array<{ value: number; weight: number }>): number {
  const w = factors.reduce((s, f) => s + f.weight, 0);
  if (w <= 0) return 0;
  return clampScore(factors.reduce((s, f) => s + f.weight, 0) / w);
}
