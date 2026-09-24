import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import BrandLogo from '../BrandLogo.js';
import { BRAND } from '../../branding/tokens.js';
import { getHubNavSections } from '../../config/productionAlphaNav.js';
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

function itemClass(active: boolean): string {
  return `crm-sidebar__item${active ? ' crm-sidebar__item--active' : ''}`;
}

/**
 * Full Hub venue workspace.
 * Daily work stays first; lower-frequency product areas live in grouped,
 * collapsible navigation rather than disappearing from the platform.
 */
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

  const sections = getHubNavSections({
    tasksBadge: opsQueue?.summary?.total || undefined,
    role: user?.role,
  });

  return (
    <div className="crm-pv-shell crm-pv-shell--sidebar">
      <header className="crm-topnav crm-topnav--utility" aria-label="Hub utility navigation">
        <button
          type="button"
          className="crm-topnav__menu-btn"
          aria-label="Open navigation"
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen(v => !v)}
        >
          ☰
        </button>

        <div className="crm-topnav__utility-brand">
          <BrandLogo size="sm" className="crm-topnav__utility-logo" />
          <div>
            <strong>{BRAND.venueName}</strong>
            <span>{BRAND.productSubtitle}</span>
          </div>
        </div>

        <div className="crm-topnav__search-wrap crm-topnav__search-wrap--utility">
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

      <div className="crm-pv-shell__workspace">
        <aside
          className={`crm-sidebar${mobileNavOpen ? ' crm-sidebar--open' : ''}`}
          aria-label="Hub workspace navigation"
        >
          <div className="crm-sidebar__brand">
            <BrandLogo size="md" className="crm-sidebar__logo" />
            <div className="crm-sidebar__brand-copy">
              <strong>{BRAND.venueName}</strong>
              <span>{BRAND.productSubtitle}</span>
              <small>{BRAND.venueLocation}</small>
            </div>
          </div>

          <nav className="crm-sidebar__nav">
            {sections.map(section => {
              const sectionActive = section.items.some(item =>
                item.match ? item.match(pathname) : pathname === item.to || pathname.startsWith(`${item.to}/`),
              );
              return (
                <details
                  key={section.id}
                  className="crm-sidebar__section"
                  open={section.defaultOpen || sectionActive}
                >
                  <summary className="crm-sidebar__section-label">
                    <span>{section.label}</span>
                    <span aria-hidden>⌄</span>
                  </summary>
                  <div className="crm-sidebar__section-items">
                    {section.items.map(item => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                          itemClass(item.match ? item.match(pathname) : isActive)
                        }
                        onClick={() => setMobileNavOpen(false)}
                      >
                        <span>{item.label}</span>
                        {item.badge != null && item.badge > 0 ? (
                          <span className="crm-sidebar__badge">{item.badge > 99 ? '99+' : item.badge}</span>
                        ) : null}
                      </NavLink>
                    ))}
                  </div>
                </details>
              );
            })}
          </nav>

          <div className="crm-sidebar__footer">
            <div className="crm-sidebar__identity">
              <span className="crm-topnav__user-avatar" aria-hidden>
                {userInitials(user?.name, user?.email)}
              </span>
              <div>
                <strong>{displayName}</strong>
                <span>{user?.role === 'super_admin' ? 'Owner / Admin' : 'Venue staff'}</span>
              </div>
            </div>
          </div>
        </aside>

        {mobileNavOpen ? (
          <button
            type="button"
            className="crm-pv-shell__backdrop"
            aria-label="Close navigation"
            onClick={() => setMobileNavOpen(false)}
          />
        ) : null}

        <div className="crm-pv-shell__main">
          <main className="crm-pv-shell__content">{children}</main>
          <HubSiteFooter compact />
        </div>
      </div>
    </div>
  );
}
