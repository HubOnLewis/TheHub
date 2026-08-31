import { useCallback, useMemo } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import type { PatchLeadPayload } from '@hub-crm/shared';
import { Spinner } from '../../components/ui/index.js';
import RecordRecoveryState from '../../components/live/RecordRecoveryState.js';
import LeadDetailCommandCenter from '../../components/leads/LeadDetailCommandCenter.js';
import DealDetailImported from '../deal/DealDetailImported.js';
import { ROUTES, opportunityDetailPath } from '../../config/paths.js';
import { useLead, useLeadMutations } from '../../hooks/useLeads.js';
import { getLeadIntelligence } from '../../data/operationalIntelligence.js';
import { mapApiLeadToViewModel, mapImportedLeadToViewModel } from '../../lib/leadDetail.js';
import { mapReferenceEventToEventDetailViewModel } from '../../lib/eventDetail.js';

function parseApiError(err: unknown): string {
  const ax = err as { response?: { data?: { error?: string } }; message?: string };
  return ax.response?.data?.error ?? ax.message ?? 'Request failed';
}

export default function LeadDetailLive() {
  const { leadId } = useParams<{ leadId: string }>();

  const eventRefModel = useMemo(
    () => (leadId ? mapReferenceEventToEventDetailViewModel(leadId) : null),
    [leadId],
  );

  if (!leadId) {
    return (
      <div className="page-simple">
        <RecordRecoveryState />
      </div>
    );
  }

  if (eventRefModel) {
    return <Navigate to={opportunityDetailPath(leadId)} replace />;
  }

  return <LeadDetailLiveBody leadId={leadId} />;
}

function LeadDetailLiveBody({ leadId }: { leadId: string }) {
  const { data: lead, isLoading, isError, refetch } = useLead(leadId);
  const { update } = useLeadMutations();

  const importedRow = useMemo(
    () => getLeadIntelligence().find(l => l.id === leadId),
    [leadId],
  );

  const linkedEventModel = useMemo(() => {
    const eventId = importedRow?.linkId;
    return eventId ? mapReferenceEventToEventDetailViewModel(eventId) : null;
  }, [importedRow?.linkId]);

  const model = useMemo(() => {
    if (lead) return mapApiLeadToViewModel(lead);
    if (importedRow) return mapImportedLeadToViewModel(importedRow);
    return null;
  }, [lead, importedRow]);

  const onPatch = useCallback(
    async (data: PatchLeadPayload) => {
      try {
        await update.mutateAsync({ id: leadId, data });
        await refetch();
      } catch (err) {
        throw new Error(parseApiError(err));
      }
    },
    [leadId, update, refetch],
  );

  if (isLoading) {
    return (
      <div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}>
        <Spinner />
      </div>
    );
  }

  if (linkedEventModel && !lead) {
    return <Navigate to={opportunityDetailPath(importedRow!.linkId!)} replace />;
  }

  if (model) {
    return (
      <LeadDetailCommandCenter
        model={model}
        onPatch={model.canPatch ? onPatch : undefined}
        patchPending={update.isPending}
        patchError={update.isError ? parseApiError(update.error) : null}
      />
    );
  }

  if (mapReferenceEventToEventDetailViewModel(leadId)) {
    return <DealDetailImported dealId={leadId} />;
  }

  return (
    <div className="page-simple">
      <div style={{ marginBottom: 16 }}>
        <Link to={ROUTES.leads} className="btn btn-ghost btn-sm">
          ← Back to Leads
        </Link>
      </div>
      <RecordRecoveryState
        title="Lead record unavailable"
        explanation="This record is not currently linked to a live CRM item."
      />
    </div>
  );
}
