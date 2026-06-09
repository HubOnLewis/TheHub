import { usePortalStore } from '../portalStore.js';

export default function PortalGuests() {
  const guestCount = usePortalStore(s => s.event.guestCount);
  const locked = usePortalStore(s => s.event.guestEstimateLocked);
  const setGuestCount = usePortalStore(s => s.setGuestCount);
  const lockGuestEstimate = usePortalStore(s => s.lockGuestEstimate);

  return (
    <>
      <h1 style={{ fontFamily: 'var(--portal-display)', fontSize: 28, margin: '0 0 20px' }}>Guests</h1>
      <div className="portal-card">
        <h3>Estimated attendance</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" className="portal-btn portal-btn--secondary" onClick={() => setGuestCount(guestCount - 1)}>
            −
          </button>
          <span className="portal-stat-val">{guestCount}</span>
          <button type="button" className="portal-btn portal-btn--secondary" onClick={() => setGuestCount(guestCount + 1)}>
            +
          </button>
        </div>
        {locked ? (
          <p style={{ color: 'var(--portal-success)', fontSize: 13, marginTop: 12 }}>Estimate locked for catering.</p>
        ) : (
          <button type="button" className="portal-btn portal-btn--primary" style={{ marginTop: 14 }} onClick={() => lockGuestEstimate()}>
            Confirm guest count
          </button>
        )}
      </div>
    </>
  );
}
