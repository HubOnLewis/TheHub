import { useMemo } from 'react';
import { mapApiDealsToWorkspaceRows } from '../lib/crmEvents.js';
import { useDeals } from './useDeals.js';

export function useLiveCrmEvents() {
  const query = useDeals({
    limit: 500,
    sort: 'updatedAt',
    order: 'desc',
  });

  const rows = useMemo(() => {
    const deals = (query.data?.data ?? []) as Array<Record<string, unknown>>;
    return mapApiDealsToWorkspaceRows(deals);
  }, [query.data]);

  return {
    rows,
    isLoading: query.isLoading,
    isError: query.isError,
    hasLiveData: !query.isError && rows.length > 0,
  };
}
