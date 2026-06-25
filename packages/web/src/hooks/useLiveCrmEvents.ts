import { useMemo } from 'react';
import { isHubContaminatedRecord, isPerfectVenueRefreshDeal } from '@hub-crm/shared';
import { mapDealToCrmRow } from '../lib/crmEvents.js';
import { useDeals } from './useDeals.js';

export function useLiveCrmEvents() {
  const query = useDeals({
    limit: 500,
    sort: 'updatedAt',
    order: 'desc',
  });

  const rows = useMemo(() => {
    const deals = (query.data?.data ?? []) as Array<Record<string, unknown>>;
    return deals
      .filter(d => {
        const fields = {
          title: String(d.title ?? ''),
          company: String(d.company ?? ''),
          contact: String(d.contact ?? ''),
          notes: typeof d.notes === 'string' ? d.notes : undefined,
          unitId: typeof d.unitId === 'string' ? d.unitId : undefined,
          unitIds: Array.isArray(d.unitIds) ? (d.unitIds as string[]) : undefined,
          importMeta:
            d.importMeta && typeof d.importMeta === 'object'
              ? (d.importMeta as { source?: string })
              : undefined,
        };
        if (isHubContaminatedRecord(fields)) return false;
        return isPerfectVenueRefreshDeal({
          source: typeof d.source === 'string' ? d.source : undefined,
          importMeta: d.importMeta as { source?: string } | undefined,
        });
      })
      .map(mapDealToCrmRow);
  }, [query.data]);

  return {
    rows,
    isLoading: query.isLoading,
    isError: query.isError,
    hasLiveData: !query.isError && rows.length > 0,
  };
}
