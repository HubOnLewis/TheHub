import { usePortalStore } from '../portalStore.js';

export default function PortalDesignBoard() {
  const layout = usePortalStore(s => s.event.layoutChoice);
  const setLayout = usePortalStore(s => s.setLayout);

  return (
    <>
      <h1 style={{ fontFamily: 'var(--portal-display)', fontSize: 28, margin: '0 0 20px' }}>Design board</h1>
      <div className="portal-card">
        <p style={{ fontSize: 13, color: 'var(--portal-muted)' }}>Floor layout selections for Event Space.</p>
        <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
          {['Crescent tables', 'Open lounge', 'Gift table by windows'].map(opt => (
            <button
              key={opt}
              type="button"
              className={`portal-btn ${layout === opt ? 'portal-btn--primary' : 'portal-btn--secondary'}`}
              style={{ width: '100%', justifyContent: 'flex-start' }}
              onClick={() => setLayout(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
        {layout ? <p style={{ marginTop: 14, fontWeight: 600 }}>Selected: {layout}</p> : null}
      </div>
    </>
  );
}
