import { useMemo } from 'react';
import { mapApiDealsToWorkspaceRows, type CrmEventRow } from '../lib/crmEvents.js';
import { resolveCrmEventSource } from '../lib/crmEventSource.js';
import { useCalendarDeals, useDeals } from './useDeals.js';

/**
 * Unified event rows for calendar, tasks, activity, search, and intelligence.
 * Prefer live API; fall back to Perfect Venue / hub-refresh import when empty.
 */
export function useLiveCrmEvents(options: { calendarOnly?: boolean } = {}) {
  const calendarQuery = useCalendarDeals();
  const dealsQuery = useDeals({ limit: 500, sort: 'updatedAt', order: 'desc' });
  const query = options.calendarOnly ? calendarQuery : dealsQuery;

  const apiRows = useMemo(() => {
    const deals = (query.data?.data ?? []) as Array<Record<string, unknown>>;
    return mapApiDealsToWorkspaceRows(deals);
  }, [query.data]);

  const apiLoaded = !query.isLoading && !query.isError;
  const apiEmpty = apiLoaded && apiRows.length === 0;
  const useApi = apiLoaded && apiRows.length > 0;

  const manifest = useMemo(
    () =>
      resolveCrmEventSource({
        apiRows,
        useApi,
        apiError: query.isError,
        apiEmpty,
      }),
    [apiRows, useApi, query.isError, apiEmpty],
  );

  const rows: CrmEventRow[] = manifest.rows;

  return {
    rows,
    apiRows,
    manifest,
    isLoading: query.isLoading,
    isError: query.isError,
    hasLiveData: useApi,
    sourceId: manifest.sourceId,
  };
}
