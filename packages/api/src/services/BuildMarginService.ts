import type { BuildDoc, BuildSpecItemDoc } from '../repositories/BuildRepository.js';

export type MarginRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface BuildBomSummary {
  lineCount: number;
  estimatedCostTotal: number;
  estimatedSellTotal: number;
  estimatedGrossMargin: number;
  estimatedGrossMarginPct?: number;
  missingCostLines: number;
  missingSellLines: number;
  hasSubstitutions: boolean;
  substitutionCount: number;
  incompletePricing: boolean;
  incompleteCosting: boolean;
  marginRiskLevel: MarginRiskLevel;
  marginRiskReasons: string[];
}

function toNum(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return undefined;
}

export class BuildMarginService {
  evaluate(build: BuildDoc & { _id: string }) {
    const lines = (build.specItems ?? []) as BuildSpecItemDoc[];
    const normalized = lines.map(line => {
      const qty = Math.max(1, toNum(line.quantity) ?? 1);
      const unitCost = toNum((line as any).unitCostEstimate ?? (line as any).estimatedCost);
      const unitSell = toNum((line as any).unitSellPrice ?? (line as any).sellPrice);
      const extendedCost = toNum((line as any).extendedCostEstimate) ?? (unitCost != null ? unitCost * qty : undefined);
      const extendedSell = toNum((line as any).extendedSellPrice) ?? (unitSell != null ? unitSell * qty : undefined);
      return { ...line, quantity: qty, unitCostEstimate: unitCost, unitSellPrice: unitSell, extendedCostEstimate: extendedCost, extendedSellPrice: extendedSell };
    });

    const estimatedCostTotal = normalized.reduce((n, l) => n + (l.extendedCostEstimate ?? 0), 0);
    const estimatedSellTotal = normalized.reduce((n, l) => n + (l.extendedSellPrice ?? 0), 0);
    const estimatedGrossMargin = estimatedSellTotal - estimatedCostTotal;
    const estimatedGrossMarginPct = estimatedSellTotal > 0 ? (estimatedGrossMargin / estimatedSellTotal) * 100 : undefined;
    const missingCostLines = normalized.filter(l => l.extendedCostEstimate == null).length;
    const missingSellLines = normalized.filter(l => l.extendedSellPrice == null).length;
    const substitutionLines = normalized.filter(l => !!(l as any).substitution);
    const hasSubstitutions = substitutionLines.length > 0;
    const substitutionCount = substitutionLines.length;
    const incompleteCosting = missingCostLines > 0;
    const incompletePricing = missingSellLines > 0;

    const reasons: string[] = [];
    let marginRiskLevel: MarginRiskLevel = 'medium';
    const setLevel = (next: MarginRiskLevel) => {
      const rank: Record<MarginRiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };
      if (rank[next] > rank[marginRiskLevel]) marginRiskLevel = next;
    };

    if ((build.status === 'quoted' || build.status === 'approved') && incompleteCosting) {
      setLevel('critical');
      reasons.push(`${build.status === 'quoted' ? 'Quoted' : 'Approved'} build has missing cost lines`);
    }
    if (estimatedSellTotal > 0 && estimatedCostTotal === 0) {
      setLevel('critical');
      reasons.push('Build has sell total but weak/no cost basis');
    }
    if (estimatedGrossMargin < 0 || (estimatedGrossMarginPct ?? 0) < 8) {
      setLevel('critical');
      reasons.push('Estimated gross margin is below threshold');
    } else if ((estimatedGrossMarginPct ?? 0) < 15) {
      setLevel('high');
      reasons.push('Estimated gross margin is below healthy threshold');
    }
    if (hasSubstitutions && substitutionLines.some(l => !toNum((l as any).unitCostEstimate) && !toNum((l as any).extendedCostEstimate))) {
      setLevel('high');
      reasons.push('Substituted parts do not have validated replacement cost');
    }
    if (normalized.some(l => ['labor', 'freight'].includes((l as any).category)) === false && normalized.length >= 5) {
      setLevel('high');
      reasons.push('Freight or labor is missing from build economics');
    }
    if (incompletePricing || incompleteCosting) {
      setLevel('medium');
      reasons.push('Some build lines are missing pricing or costing');
    }
    if (!incompletePricing && !incompleteCosting && (estimatedGrossMarginPct ?? 0) >= 20) {
      marginRiskLevel = 'low';
      reasons.push('Build pricing appears complete and margin is healthy');
    }

    return {
      normalizedLines: normalized.map(l => ({
        ...l,
        costSource: (l as any).costSource ?? 'manual',
        pricingSource: (l as any).pricingSource ?? 'manual',
      })),
      buildBomSummary: {
        lineCount: normalized.length,
        estimatedCostTotal,
        estimatedSellTotal,
        estimatedGrossMargin,
        estimatedGrossMarginPct,
        missingCostLines,
        missingSellLines,
        hasSubstitutions,
        substitutionCount,
        incompletePricing,
        incompleteCosting,
        marginRiskLevel,
        marginRiskReasons: Array.from(new Set(reasons)),
      } as BuildBomSummary,
    };
  }
}

export const buildMarginService = new BuildMarginService();
