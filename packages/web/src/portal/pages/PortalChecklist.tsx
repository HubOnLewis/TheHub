import { usePortalStore } from '../portalStore.js';

export default function PortalChecklist() {
  const checklist = usePortalStore(s => s.event.checklist);
  const toggle = usePortalStore(s => s.toggleChecklist);
  const done = checklist.filter(c => c.complete).length;

  return (
    <>
      <h1 style={{ fontFamily: 'var(--portal-display)', fontSize: 28, margin: '0 0 8px' }}>Planning checklist</h1>
      <p style={{ color: 'var(--portal-muted)', margin: '0 0 16px' }}>
        {done} of {checklist.length} complete
      </p>
      <div className="portal-card">
        {checklist.map(c => (
          <label key={c.id} className="portal-check-row" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={c.complete} onChange={() => toggle(c.id)} />
            <span>
              <strong>{c.label}</strong>
              {c.due ? <span style={{ display: 'block', fontSize: 11, color: 'var(--portal-muted)' }}>Due {c.due}</span> : null}
            </span>
          </label>
        ))}
      </div>
    </>
  );
}
