import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../config/paths.js';
import RecordRecoveryState from '../../components/live/RecordRecoveryState.js';
import EventDetailCommandCenter from '../../components/deals/EventDetailCommandCenter.js';
import { mapReferenceEventToEventDetailViewModel } from '../../lib/eventDetail.js';

type Props = { dealId: string };

/** Import/reference-only event detail — same command center layout, read-only. */
export default function DealDetailImported({ dealId }: Props) {
  const model = useMemo(() => mapReferenceEventToEventDetailViewModel(dealId), [dealId]);

  if (!model) {
    return (
      <div className="page-simple">
        <Link to={ROUTES.opportunities} className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }}>
          ← Back to Events
        </Link>
        <RecordRecoveryState
          title="Event record unavailable"
          explanation="This record is not currently linked to a live CRM item."
        />
      </div>
    );
  }

  return <EventDetailCommandCenter model={model} />;
}
