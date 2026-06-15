import { useEffect, useState } from 'react';
import { BRAND } from '../branding/tokens.js';
import { isProductionCRM } from '../config/productionData.js';

function formatClock(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

function formatDateShort(d: Date): string {
  return d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

type Props = { slim?: boolean };

export default function TopbarStatus({ slim = false }: Props) {
  const [now, setNow] = useState(() => new Date());
  const [pulseLive, setPulseLive] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (isProductionCRM()) return;
    let cancelled = false;
    import('../state/demoOpsStore.js').then(({ useDemoOpsStore }) => {
      const tick = () => {
        if (cancelled) return;
        const lastPulseAt = useDemoOpsStore.getState().lastPulseAt;
        setPulseLive(Date.now() - new Date(lastPulseAt).getTime() < 120_000);
      };
      tick();
      const id = setInterval(tick, 5_000);
      return () => clearInterval(id);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="topbar-status" aria-label="Venue operational status">
      <div className="topbar-status__cluster">
        <span className="topbar-status__clock">{formatClock(now)}</span>
        <span className="topbar-status__venue">{BRAND.venueName}</span>
        <span className="topbar-status__meta">
          {formatDateShort(now)} · {BRAND.venueLocation}
          {slim ? '' : pulseLive ? ' · Live' : isProductionCRM() ? '' : ' · Monitoring'}
        </span>
      </div>
      {!slim && !isProductionCRM() && (
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