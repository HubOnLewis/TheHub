import { useMemo } from 'react';
import { buildVenueCommandState, type VenueCommandState } from '../data/venueCommandState.js';
import { countPendingApprovals, useDemoOpsStore } from '../state/demoOpsStore.js';

export function useVenueCommandState(): VenueCommandState {
  const approvals = useDemoOpsStore(s => s.approvals);
  const pending = countPendingApprovals(approvals);

  return useMemo(() => buildVenueCommandState({ pendingApprovals: pending }), [pending]);
}
