import { Link } from 'react-router-dom';
import { usePortalStore } from '../portalStore.js';

const ROLES = [
  { role: 'client', label: 'Primary client' },
  { role: 'co_planner', label: 'Co-planner' },
  { role: 'partner', label: 'Partner / spouse' },
  { role: 'vendor', label: 'Vendor (limited)' },
] as const;

export default function PortalSettings() {
  const session = usePortalStore(s => s.session);
  const reset = usePortalStore(s => s.resetPortalDemo);

  return (
    <>
      <h1 style={{ fontFamily: 'var(--portal-display)', fontSize: 28, margin: '0 0 20px' }}>Portal settings</h1>
      <div className="portal-card portal-card--flat">
        <h3>Your profile</h3>
        <p style={{ margin: 0 }}>{session?.user.name ?? '—'}</p>
        <p style={{ fontSize: 13, color: 'var(--portal-muted)' }}>{session?.user.email}</p>
        <span className="portal-status portal-status--signed">{session?.user.role ?? 'client'}</span>
      </div>
      <div className="portal-card portal-card--flat" style={{ marginTop: 16 }}>
        <h3>Future roles (architecture)</h3>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
          {ROLES.map(r => (
            <li key={r.role}>{r.label}</li>
          ))}
        </ul>
        <p style={{ fontSize: 12, color: 'var(--portal-muted)', marginTop: 10 }}>Magic links & invite flows — production auth.</p>
      </div>
      <div className="portal-card portal-card--flat" style={{ marginTop: 16 }}>
        <h3>Demo controls</h3>
        <button type="button" className="portal-btn portal-btn--secondary" onClick={() => reset()}>
          Reset portal demo state
        </button>
        <Link to="/settings/demo-controls" style={{ display: 'block', marginTop: 12, fontSize: 12 }}>
          Venue team demo controls →
        </Link>
      </div>
    </>
  );
}
