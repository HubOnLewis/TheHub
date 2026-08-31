import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import BrandLogo from '../../components/BrandLogo.js';
import { PORTAL_ROUTES } from '../paths.js';
import { usePortalStore } from '../portalStore.js';
import { portalPathForNav, useGuestFacts } from '../guestFacts.js';

const NAV_MORE = [
  { to: PORTAL_ROUTES.checklist, label: 'Checklist' },
  { to: PORTAL_ROUTES.details, label: 'Event details' },
  { to: PORTAL_ROUTES.guests, label: 'Guests' },
  { to: PORTAL_ROUTES.designBoard, label: 'Design' },
  { to: PORTAL_ROUTES.settings, label: 'Settings' },
] as const;

export default function PortalShell() {
  const logout = usePortalStore(s => s.logout);
  const navigate = useNavigate();
  const user = usePortalStore(s => s.session?.user);
  const profile = usePortalStore(s => s.profile);
  const refreshSnapshot = usePortalStore(s => s.refreshSnapshot);
  const { nav, phase } = useGuestFacts();
  const showPlanningNav = phase === 'details' || phase === 'final_pay' || phase === 'day_of';

  useEffect(() => {
    void refreshSnapshot();
  }, [refreshSnapshot]);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `portal-nav-link${isActive ? ' active' : ''}`;

  return (
    <div className="portal-root">
      <header className="portal-top">
        <div className="portal-top__brand">
          <BrandLogo size="sm" />
        </div>
        <div className="portal-top__event-wrap">
          <span className="portal-top__event">{profile.title}</span>
          {profile.displayDate ? (
            <span className="portal-top__date">{profile.displayDate}</span>
          ) : null}
        </div>
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
          {nav.map(n => (
            <NavLink key={`${n.to}-${n.label}`} to={portalPathForNav(n.to)} className={linkClass}>
              {n.label}
            </NavLink>
          ))}
          {showPlanningNav ? (
            <>
              <div style={{ height: 12 }} />
              {NAV_MORE.map(n => (
                <NavLink key={n.to} to={n.to} className={linkClass}>
                  {n.label}
                </NavLink>
              ))}
              <NavLink to={PORTAL_ROUTES.event(profile.id)} className={linkClass} style={{ marginTop: 12 }}>
                Event workspace
              </NavLink>
            </>
          ) : null}
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
        {nav.map(n => (
          <NavLink key={`${n.to}-${n.label}-m`} to={portalPathForNav(n.to)} className={linkClass}>
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
