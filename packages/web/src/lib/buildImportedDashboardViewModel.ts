import { buildDashboardViewModel, type DashboardViewModel } from '../data/buildDashboardViewModel.js';
import { formatTodayLabel } from '../config/productionData.js';
import { getOperationalSourceNote } from './operationalSource.js';
import type { VenueCommandExternal } from '../data/venueCommandState.js';

export type ImportedDashboardViewModel = DashboardViewModel & {
  sourceNote: string;
};

/** PV import dashboard — runtime Today label + separate import freshness note. */
export function buildImportedDashboardViewModel(
  external: VenueCommandExternal = { pendingApprovals: 0 },
): ImportedDashboardViewModel {
  const model = buildDashboardViewModel(external);
  return {
    ...model,
    asOfLabel: formatTodayLabel(),
    sourceNote: getOperationalSourceNote(),
    suggestedAction: model.suggestedAction.replace(/Today view/gi, 'Events'),
  };
}