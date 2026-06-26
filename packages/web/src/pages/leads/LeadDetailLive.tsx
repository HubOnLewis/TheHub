import { useMemo } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Spinner } from '../../components/ui/index.js';
import RecordRecoveryState from '../../components/live/RecordRecoveryState.js';
import LeadDetailCommandCenter from '../../components/leads/LeadDetailCommandCenter.js';
import DealDetailImported from '../deal/DealDetailImported.js';
import { ROUTES, opportunityDetailPath } from '../../config/paths.js';
import { useLead } from '../../hooks/useLeads.js';
import { getLeadIntelligence } from '../../data/operationalIntelligence.js';
import { mapApiLeadToViewModel, mapImportedLeadToViewModel } from '../../lib/leadDetail.js';
import { mapReferenceEventToEventDetailViewModel } from '../../lib/eventDetail.js';

export default function LeadDetailLive() {
  const { leadId } = useParams<{ leadId: string }>();

  if (!leadId) {
    return (
      <div className="page-simple">
        <RecordRecoveryState />
      </div>
    );
  }

  const eventRefModel = useMemo(
    () => mapReferenceEventToEventDetailViewModel(leadId),
    [leadId],
  );

  if (eventRefModel) {
    return <Navigate to={opportunityDetailPath(leadId)} replace />;
  }

  return <LeadDetailLiveBody leadId={leadId} />;
}

function LeadDetailLiveBody({ leadId }: { leadId: string }) {
  const { data: lead, isLoading, isError } = useLead(leadId);

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
    return <LeadDetailCommandCenter model={model} />;
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
        explanation={
          isError
            ? 'This record is not currently linked to a live CRM item.'
            : 'This record is not currently linked to a live CRM item.'
        }
      />
    </div>
  );
}
