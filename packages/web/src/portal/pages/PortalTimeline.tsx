import { usePortalStore } from '../portalStore.js';

export default function PortalTimeline() {
  const timeline = usePortalStore(s => s.event.timeline);

  return (
    <>
      <h1 style={{ fontFamily: 'var(--portal-display)', fontSize: 28, margin: '0 0 8px' }}>Timeline memory</h1>
      <p style={{ color: 'var(--portal-muted)', margin: '0 0 20px' }}>
        Every update, payment, approval, and recommendation in one place.
      </p>
      <ul className="portal-timeline">
        {timeline.map(t => (
          <li key={t.id}>
            <span style={{ fontSize: 11, color: 'var(--portal-muted)' }}>{t.at}</span>
            <strong style={{ display: 'block' }}>{t.title}</strong>
            {t.detail ? <span style={{ fontSize: 13 }}>{t.detail}</span> : null}
          </li>
        ))}
      </ul>
    </>
  );
}
