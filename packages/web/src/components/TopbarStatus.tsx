import { useEffect, useState } from 'react';
import { DEMO_VENUE_NAME } from '../data/demoVenue.js';
import { useDemoOpsStore } from '../state/demoOpsStore.js';

function formatClock(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

function formatDateShort(d: Date): string {
  return d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

type Props = { slim?: boolean };

export default function TopbarStatus({ slim = false }: Props) {
  const [now, setNow] = useState(() => new Date());
  const lastPulseAt = useDemoOpsStore(s => s.lastPulseAt);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const pulseLive = Date.now() - new Date(lastPulseAt).getTime() < 120_000;

  return (
    <div className="topbar-status" aria-label="Venue operational status">
      <div className="topbar-status__cluster">
        <span className="topbar-status__clock">{formatClock(now)}</span>
        <span className="topbar-status__venue">{DEMO_VENUE_NAME}</span>
        <span className="topbar-status__meta">
          {formatDateShort(now)} · Wichita
          {slim ? '' : pulseLive ? ' · Live' : ' · Monitoring'}
        </span>
      </div>
      {!slim && (
        <div className="topbar-status__indicators">
          <span className="staff-online" title="Staff on duty">
            <span className="staff-online__dot" aria-hidden />
            On duty
          </span>
        </div>
      )}
    </div>
  );
}
