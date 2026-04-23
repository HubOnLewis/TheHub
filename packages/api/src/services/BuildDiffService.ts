export interface BuildDiffResult {
  addedItems: Array<Record<string, unknown>>;
  removedItems: Array<Record<string, unknown>>;
  modifiedItems: Array<{ before: Record<string, unknown>; after: Record<string, unknown>; fields: string[] }>;
  costDelta: number;
  sellDelta: number;
  marginDelta: number;
  changeSummary: string[];
}

function lineKey(line: Record<string, unknown>) {
  return String(line.id ?? `${line.category ?? ''}:${line.partNumber ?? ''}:${line.description ?? ''}`);
}

function extCost(line: Record<string, unknown>) {
  const qty = Number(line.quantity ?? 1);
  const explicit = line.extendedCostEstimate;
  if (typeof explicit === 'number') return explicit;
  return typeof line.unitCostEstimate === 'number' ? qty * Number(line.unitCostEstimate) : 0;
}

function extSell(line: Record<string, unknown>) {
  const qty = Number(line.quantity ?? 1);
  const explicit = line.extendedSellPrice;
  if (typeof explicit === 'number') return explicit;
  return typeof line.unitSellPrice === 'number' ? qty * Number(line.unitSellPrice) : 0;
}

export class BuildDiffService {
  compare(versionA: { specItems: Array<Record<string, unknown>> }, versionB: { specItems: Array<Record<string, unknown>> }): BuildDiffResult {
    const aMap = new Map(versionA.specItems.map(x => [lineKey(x), x]));
    const bMap = new Map(versionB.specItems.map(x => [lineKey(x), x]));

    const addedItems: Array<Record<string, unknown>> = [];
    const removedItems: Array<Record<string, unknown>> = [];
    const modifiedItems: Array<{ before: Record<string, unknown>; after: Record<string, unknown>; fields: string[] }> = [];

    for (const [k, b] of bMap.entries()) {
      const a = aMap.get(k);
      if (!a) {
        addedItems.push(b);
        continue;
      }
      const fields = ['description', 'quantity', 'unitCostEstimate', 'unitSellPrice', 'extendedCostEstimate', 'extendedSellPrice', 'partNumber', 'vendorName', 'substitution']
        .filter(f => JSON.stringify((a as any)[f]) !== JSON.stringify((b as any)[f]));
      if (fields.length > 0) modifiedItems.push({ before: a, after: b, fields });
    }
    for (const [k, a] of aMap.entries()) {
      if (!bMap.has(k)) removedItems.push(a);
    }

    const costDelta = versionB.specItems.reduce((n, l) => n + extCost(l), 0) - versionA.specItems.reduce((n, l) => n + extCost(l), 0);
    const sellDelta = versionB.specItems.reduce((n, l) => n + extSell(l), 0) - versionA.specItems.reduce((n, l) => n + extSell(l), 0);
    const marginDelta = sellDelta - costDelta;
    const changeSummary: string[] = [];
    if (addedItems.length) changeSummary.push(`Added ${addedItems.length} item(s)`);
    if (removedItems.length) changeSummary.push(`Removed ${removedItems.length} item(s)`);
    if (modifiedItems.length) changeSummary.push(`Modified ${modifiedItems.length} item(s)`);
    if (costDelta !== 0) changeSummary.push(`Cost delta ${costDelta > 0 ? '+' : ''}${Math.round(costDelta)}`);
    if (sellDelta !== 0) changeSummary.push(`Sell delta ${sellDelta > 0 ? '+' : ''}${Math.round(sellDelta)}`);
    if (changeSummary.length === 0) changeSummary.push('No material changes');

    return { addedItems, removedItems, modifiedItems, costDelta, sellDelta, marginDelta, changeSummary };
  }
}

export const buildDiffService = new BuildDiffService();
