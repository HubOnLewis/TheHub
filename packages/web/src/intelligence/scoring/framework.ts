/** Normalize any numeric input to 0–100 integer. */
export function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function weightedScore(
  factors: Array<{ value: number; weight: number }>,
): number {
  const w = factors.reduce((s, f) => s + f.weight, 0);
  if (w <= 0) return 0;
  return clampScore(factors.reduce((s, f) => s + f.value * f.weight, 0) / w);
}

export function inverseUrgency(days: number, maxDays: number): number {
  return clampScore(100 - (days / maxDays) * 100);
}

export function ratioScore(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return clampScore((part / whole) * 100);
}
