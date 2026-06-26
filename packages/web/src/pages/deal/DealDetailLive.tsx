import { useMemo, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import client from '../../api/client.js';
import { ROUTES } from '../../config/paths.js';
import { Spinner } from '../../components/ui/index.js';
import LiveEmptyState from '../../components/live/LiveEmptyState.js';
import { isHubContaminatedRecord } from '@hub-crm/shared';
import type { PatchDealPayload } from '@hub-crm/shared';
import { getHubRefreshEventById } from '../../data/hubRefreshDataLayer.js';
import { getFullPvEventById } from '../../data/pvDataLayer.js';
import { useDeal } from '../../hooks/useDeal.js';
import { useDealInteractions, useDealMutations } from '../../hooks/useDeals.js';
import type { InteractionRow } from '../../hooks/useInteractions.js';
import { mapDealToEventDetailViewModel } from '../../lib/eventDetail.js';
import EventDetailCommandCenter from '../../components/deals/EventDetailCommandCenter.js';
import DealDetailImported from './DealDetailImported.js';

function parseApiError(err: unknown): string {
  const ax = err as { response?: { data?: { error?: string } }; message?: string };
  return ax.response?.data?.error ?? ax.message ?? 'Request failed';
}

function EventDetailLivePage({ dealId }: { dealId: string }) {
  const qc = useQueryClient();
  const { data: deal, isLoading, isError, refetch } = useDeal(dealId);
  const { data: interactions = [], isLoading: ixLoading } = useDealInteractions(dealId);
  const { update } = useDealMutations();

  const hubRefresh = useMemo(() => getHubRefreshEventById(dealId), [dealId]);

  const model = useMemo(() => {
    if (!deal) return null;
    return mapDealToEventDetailViewModel(
      deal,
      hubRefresh,
      interactions as InteractionRow[],
    );
  }, [deal, hubRefresh, interactions]);

  const onPatch = useCallback(
    async (data: PatchDealPayload) => {
      try {
        await update.mutateAsync({ id: dealId, data });
        await refetch();
      } catch (err) {
        throw new Error(parseApiError(err));
      }
    },
    [dealId, update, refetch],
  );

  const onAddNote = useCallback(
    async (summary: string, body: string) => {
      const companyId = model?.companyId;
      if (!companyId) {
        throw new Error('This event is not linked to an account yet, so notes cannot be saved.');
      }
      try {
        await client.post('/interactions', {
          companyId,
          relatedDealId: dealId,
          type: 'note',
          direction: 'outbound',
          summary,
          body,
          outcome: 'other',
          status: 'completed',
        });
        await qc.invalidateQueries({ queryKey: ['deals', dealId, 'interactions'] });
        await refetch();
      } catch (err) {
        throw new Error(parseApiError(err));
      }
    },
    [model?.companyId, dealId, qc, refetch],
  );

  if (isLoading || ixLoading) {
    return (
      <div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}>
        <Spinner />
      </div>
    );
  }

  if (!model) {
    return (
      <div className="page-simple">
        <Link to={ROUTES.opportunities} className="btn btn-ghost" style={{ fontSize: 12, marginBottom: 16 }}>
          ← Events
        </Link>
        <div className="card page-section">
          <LiveEmptyState hint={isError ? 'This event was not found in CRM.' : undefined} />
        </div>
      </div>
    );
  }

  return (
    <EventDetailCommandCenter
      model={model}
      onPatch={onPatch}
      onAddNote={model.companyId ? onAddNote : undefined}
      patchPending={update.isPending}
      patchError={update.isError ? parseApiError(update.error) : null}
    />
  );
}

export function DealDetailLiveShell({
  isLoading,
  isError,
  deal,
}: {
  isLoading: boolean;
  isError: boolean;
  deal: Record<string, unknown> | undefined;
}) {
  const { dealId } = useParams<{ dealId: string }>();

  if (!dealId) {
    return (
      <div className="page-simple">
        <LiveEmptyState hint="No event selected." />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}>
        <Spinner />
      </div>
    );
  }

  if (deal) {
    if (
      isHubContaminatedRecord({
        title: String(deal.title ?? ''),
        company: String(deal.company ?? ''),
        contact: String(deal.contact ?? ''),
        notes: typeof deal.notes === 'string' ? deal.notes : undefined,
        unitId: typeof deal.unitId === 'string' ? deal.unitId : undefined,
        unitIds: Array.isArray(deal.unitIds) ? (deal.unitIds as string[]) : undefined,
      })
    ) {
      if (getFullPvEventById(dealId)) {
        return <DealDetailImported dealId={dealId} />;
      }
      return (
        <div className="page-simple hub-demo-deal-page">
          <Link to={ROUTES.opportunities} className="btn btn-ghost" style={{ fontSize: 12, marginBottom: 16 }}>
            ← Events
          </Link>
          <div className="card page-section">
            <LiveEmptyState hint="This record is not part of the venue event CRM." />
          </div>
        </div>
      );
    }
    return <EventDetailLivePage dealId={dealId} />;
  }

  if (getFullPvEventById(dealId)) {
    return <DealDetailImported dealId={dealId} />;
  }

  return (
    <div className="page-simple">
      <Link to={ROUTES.opportunities} className="btn btn-ghost" style={{ fontSize: 12, marginBottom: 16 }}>
        ← Events
      </Link>
      <div className="card page-section">
        <LiveEmptyState hint={isError ? 'This event was not found in CRM.' : undefined} />
      </div>
    </div>
  );
}

/** @deprecated Use DealDetailLiveShell — kept for import compatibility */
export default function DealDetailLive({ deal }: { deal: Record<string, unknown> }) {
  const id = String(deal._id ?? '');
  return <EventDetailLivePage dealId={id} />;
}
