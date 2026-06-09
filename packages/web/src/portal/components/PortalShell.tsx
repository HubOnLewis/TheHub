import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import BrandLogo from '../../components/BrandLogo.js';
import { PORTAL_ROUTES } from '../paths.js';
import { PORTAL_DEMO_EVENT } from '../demoData.js';
import { usePortalStore } from '../portalStore.js';

const NAV = [
  { to: PORTAL_ROUTES.dashboard, label: 'Home' },
  { to: PORTAL_ROUTES.payments, label: 'Pay' },
  { to: PORTAL_ROUTES.documents, label: 'Docs' },
  { to: PORTAL_ROUTES.messages, label: 'Messages' },
  { to: PORTAL_ROUTES.timeline, label: 'Activity' },
] as const;

const NAV_MORE = [
  { to: PORTAL_ROUTES.checklist, label: 'Checklist' },
  { to: PORTAL_ROUTES.guests, label: 'Guests' },
  { to: PORTAL_ROUTES.designBoard, label: 'Design' },
  { to: PORTAL_ROUTES.settings, label: 'Settings' },
] as const;

export default function PortalShell() {
  const logout = usePortalStore(s => s.logout);
  const navigate = useNavigate();
  const user = usePortalStore(s => s.session?.user);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `portal-nav-link${isActive ? ' active' : ''}`;

  return (
    <div className="portal-root">
      <header className="portal-top">
        <div className="portal-top__brand">
          <BrandLogo size="sm" />
        </div>
        <span className="portal-top__event">{PORTAL_DEMO_EVENT.title}</span>
        <button
          type="button"
          className="portal-btn portal-btn--ghost"
          style={{ fontSize: 12 }}
          onClick={() => {
            logout();
            navigate(PORTAL_ROUTES.login);
          }}
        >
          Sign out
        </button>
      </header>

      <div className="portal-shell">
        <nav className="portal-nav-side" aria-label="Portal navigation">
          {NAV.map(n => (
            <NavLink key={n.to} to={n.to} className={linkClass}>
              {n.label}
            </NavLink>
          ))}
          <div style={{ height: 12 }} />
          {NAV_MORE.map(n => (
            <NavLink key={n.to} to={n.to} className={linkClass}>
              {n.label}
            </NavLink>
          ))}
          <NavLink to={PORTAL_ROUTES.event(PORTAL_DEMO_EVENT.id)} className={linkClass} style={{ marginTop: 12 }}>
            Event workspace
          </NavLink>
          {user ? (
            <p style={{ fontSize: 11, color: 'var(--portal-muted)', marginTop: 20, padding: '0 12px' }}>
              {user.name}
            </p>
          ) : null}
        </nav>

        <main className="portal-main">
          <Outlet />
        </main>
      </div>

      <nav className="portal-nav-bottom" aria-label="Portal mobile navigation">
        {NAV.map(n => (
          <NavLink key={n.to} to={n.to} className={linkClass}>
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
