import GuestStatusTimeline from '../components/GuestStatusTimeline.js';
import { usePortalStore } from '../portalStore.js';

export default function PortalTimeline() {
  const timeline = usePortalStore(s => s.event.timeline);
  const checklist = usePortalStore(s => s.event.checklist);
  const toggle = usePortalStore(s => s.toggleChecklist);
  const nextDates = usePortalStore(s => s.snapshot?.nextDates ?? []);
  const playbook = usePortalStore(s => s.snapshot?.playbook);

  return (
    <>
      <h1 style={{ fontFamily: 'var(--portal-display)', fontSize: 28, margin: '0 0 8px' }}>Timeline</h1>
      <p style={{ color: 'var(--portal-muted)', margin: '0 0 20px' }}>
        Inquiry through day-of — live as staff update your event.
      </p>
      <GuestStatusTimeline />
      {playbook?.clientTimeline?.length ? (
        <div className="portal-card portal-card--flat" style={{ margin: '16px 0' }}>
          <h3>Your dates</h3>
          <p style={{ fontSize: 13, color: 'var(--portal-muted)' }}>
            Check off when done. Your coordinator sees the same list. Undo anytime.
          </p>
          {checklist.map(c => (
            <label key={c.id} className="portal-check-row" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={c.complete} onChange={() => toggle(c.id)} />
              <span>
                <strong>{c.label}</strong>
                {c.due ? (
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--portal-muted)' }}>Due {c.due}</span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      ) : nextDates.length > 0 ? (
        <div className="portal-card portal-card--flat" style={{ margin: '16px 0' }}>
          <h3>Next dates</h3>
          <ul>
            {nextDates.map(d => (
              <li key={d.label}>
                <strong>{d.label}</strong>
                {d.date ? ` · ${d.date}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
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
