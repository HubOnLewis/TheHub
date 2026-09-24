import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import BrandLogo from '../BrandLogo.js';
import { BRAND } from '../../branding/tokens.js';
import { getHubTopNavItems } from '../../config/productionAlphaNav.js';
import { useVenueOpsQueue } from '../../hooks/useVenueOps.js';
import { useAppStore } from '../../store/index.js';
import HubThemeToggle from './HubThemeToggle.js';
import GlobalSearch from '../venue/GlobalSearch.js';
import HubSiteFooter from '../HubSiteFooter.js';

type Props = {
  children: ReactNode;
  mobileNavOpen: boolean;
  setMobileNavOpen: Dispatch<SetStateAction<boolean>>;
  onLogout: () => void;
};

function userInitials(name?: string | null, email?: string | null): string {
  const source = name?.trim() || email?.trim() || '?';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function navClass(active: boolean): string {
  return `crm-topnav__link${active ? ' crm-topnav__link--active' : ''}`;
}

/** Four-screen venue desk: Today · Calendar · Events · Settings */
export default function HubAdminShell({
  children,
  mobileNavOpen,
  setMobileNavOpen,
  onLogout,
}: Props) {
  const { pathname } = useLocation();
  const user = useAppStore(s => s.user);
  const displayName = user?.name?.trim() || user?.email?.split('@')[0] || 'User';
  const { data: opsQueue } = useVenueOpsQueue();

  const items = getHubTopNavItems({
    tasksBadge: opsQueue?.summary?.total || undefined,
    role: user?.role,
  });

  return (
    <div className="crm-pv-shell">
      <header className="crm-topnav crm-topnav--light" aria-label="Venue navigation">
        <button
          type="button"
          className="crm-topnav__menu-btn"
          aria-label="Open navigation"
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen(v => !v)}
        >
          ☰
        </button>
        <div className="crm-topnav__brand">
          <BrandLogo size="md" className="crm-topnav__logo" />
          <div className="crm-topnav__venue">
            <span className="crm-topnav__venue-name">{BRAND.venueName}</span>
            <span className="crm-topnav__venue-sub">{BRAND.productSubtitle}</span>
            <span className="crm-topnav__venue-loc">{BRAND.venueLocation}</span>
          </div>
        </div>
        <nav className={`crm-topnav__links${mobileNavOpen ? ' crm-topnav__links--open' : ''}`}>
          {items.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                navClass(item.match ? item.match(pathname) : isActive)
              }
              onClick={() => setMobileNavOpen(false)}
            >
              {item.label}
              {item.badge != null && item.badge > 0 ? (
                <span className="crm-topnav__badge">{item.badge > 99 ? '99+' : item.badge}</span>
              ) : null}
            </NavLink>
          ))}
        </nav>
        <div className="crm-topnav__search-wrap">
          <GlobalSearch />
        </div>
        <div className="crm-topnav__tools">
          <HubThemeToggle />
          <div className="crm-topnav__user" title={user?.email ?? undefined}>
            <span className="crm-topnav__user-avatar" aria-hidden>
              {userInitials(user?.name, user?.email)}
            </span>
            <span className="crm-topnav__user-name">{displayName}</span>
          </div>
          <button type="button" className="crm-topnav__icon" onClick={onLogout} title="Sign out">
            Sign out
          </button>
        </div>
      </header>
      {mobileNavOpen ? (
        <button
          type="button"
          className="crm-pv-shell__backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}
      <main className="crm-pv-shell__content">{children}</main>
      <HubSiteFooter compact />
    </div>
  );
}
