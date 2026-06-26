import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../config/paths.js';
import LiveEmptyState from '../../components/live/LiveEmptyState.js';
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
        <div className="card page-section">
          <LiveEmptyState hint="This event could not be loaded." />
        </div>
      </div>
    );
  }

  return <EventDetailCommandCenter model={model} />;
}
