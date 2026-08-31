import { Link } from 'react-router-dom';
import LoadingState from '../../components/crm/LoadingState.js';
import VenueCalendar from '../../components/calendar/VenueCalendar.js';
import { useLiveCrmEvents } from '../../hooks/useLiveCrmEvents.js';
import { ROUTES } from '../../config/paths.js';
import { datedRows, isLost } from '../../lib/liveEventHelpers.js';

export default function LiveCalendarPage() {
  const { rows, isLoading, isError, sourceId } = useLiveCrmEvents({ calendarOnly: true });
  const dated = datedRows(rows).filter(r => !isLost(r));

  if (isLoading) return <LoadingState message="Loading calendar…" />;

  return (
    <div className="hub-live-page venue-cal-page">
      <header className="hub-admin-page__header">
        <div>
          <h1 className="hub-admin-page__title">Calendar</h1>
          <p className="hub-admin-page__subtitle">
            Week and day schedule by space — conflict detection keeps you from double-booking.
            {sourceId === 'live-api' ? ' Live pipeline.' : ' Imported venue data.'}
          </p>
        </div>
        <div className="hub-admin-page__header-actions">
          <span className="hub-admin-stat-pill">
            {dated.length} dated event{dated.length === 1 ? '' : 's'}
          </span>
          <Link to={`${ROUTES.dashboard}?new=1`} className="btn btn-primary btn-sm">
            + Add event
          </Link>
        </div>
      </header>

      {isError ? (
        <div className="card hub-live-empty" style={{ marginBottom: 16 }}>
          <p className="hub-live-empty__title">Could not refresh live API</p>
          <p className="text-muted text-sm">Showing imported venue events when available.</p>
        </div>
      ) : null}

      {dated.length === 0 ? (
        <div className="card hub-live-empty">
          <p className="hub-live-empty__title">No dated events yet</p>
          <p className="text-muted text-sm">
            Add an event with a date, or import Perfect Venue data, to populate the calendar.
          </p>
          <Link to={`${ROUTES.dashboard}?new=1`} className="btn btn-primary" style={{ marginTop: 12 }}>
            Add event
          </Link>
        </div>
      ) : (
        <VenueCalendar rows={dated} hideLostDefault />
      )}
    </div>
  );
}
