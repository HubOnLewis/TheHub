import { NavLink, useLocation } from 'react-router-dom';
import BrandLogo from '../BrandLogo.js';
import { BRAND } from '../../branding/tokens.js';
import { ROUTES } from '../../config/paths.js';
import { PV_INBOX_MESSAGES, PV_TASKS } from '../../data/perfectVenueSeed.js';
import { isProductionCRM } from '../../config/productionData.js';
import { useAppStore } from '../../store/index.js';

type NavItem = {
  to: string;
  label: string;
  badge?: number;
  match?: (pathname: string) => boolean;
};

function unreadInbox(): number {
  return PV_INBOX_MESSAGES.filter(m => m.unread).length;
}

function openTasks(): number {
  return PV_TASKS.length;
}

function navClass(active: boolean): string {
  return `crm-topnav__link${active ? ' crm-topnav__link--active' : ''}`;
}

function userInitials(name?: string | null, email?: string | null): string {
  const source = name?.trim() || email?.trim() || '?';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export default function CrmTopNav() {
  const { pathname } = useLocation();
  const user = useAppStore(s => s.user);
  const hideBadges = isProductionCRM();

  const items: NavItem[] = [
    {
      to: ROUTES.dashboard,
      label: 'Home',
      match: p => p === ROUTES.dashboard || p === ROUTES.opportunities || p === ROUTES.dealsAlias,
    },
    {
      to: ROUTES.inbox,
      label: 'Inbox',
      badge: hideBadges ? undefined : unreadInbox(),
    },
    { to: ROUTES.calendar, label: 'Calendar' },
    {
      to: ROUTES.tasks,
      label: 'Tasks',
      badge: hideBadges ? undefined : openTasks(),
    },
    { to: `${ROUTES.settings}/express-book`, label: 'Express Book' },
    { to: ROUTES.monthlyScorecard, label: 'Reports' },
    { to: ROUTES.settings, label: 'Settings', match: p => p === ROUTES.settings || p.startsWith(`${ROUTES.settings}/`) },
  ];

  const displayName = user?.name?.trim() || user?.email?.split('@')[0] || 'User';

  return (
    <header className="crm-topnav" aria-label="CRM navigation">
      <div className="crm-topnav__brand">
        <BrandLogo size="sm" />
        <div className="crm-topnav__venue">
          <span className="crm-topnav__venue-name">{BRAND.venueName}</span>
          <span className="crm-topnav__venue-sub">{BRAND.productName}</span>
        </div>
      </div>
      <nav className="crm-topnav__links">
        {items.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              navClass(item.match ? item.match(pathname) : isActive)
            }
          >
            {item.label}
            {item.badge != null && item.badge > 0 ? (
              <span className="crm-topnav__badge">{item.badge > 99 ? '99+' : item.badge}</span>
            ) : null}
          </NavLink>
        ))}
      </nav>
      <div className="crm-topnav__search-wrap">
        <span className="crm-topnav__search-icon" aria-hidden>
          ⌕
        </span>
        <input
          type="search"
          className="crm-topnav__search"
          placeholder="Search events, contacts, tasks, or navigate…"
          aria-label="Global search"
          readOnly
        />
      </div>
      <div className="crm-topnav__tools">
        <button type="button" className="crm-topnav__icon" title="Help" aria-label="Help">
          ?
        </button>
        <div className="crm-topnav__user" title={user?.email ?? undefined}>
          <span className="crm-topnav__user-avatar" aria-hidden>
            {userInitials(user?.name, user?.email)}
          </span>
          <span className="crm-topnav__user-name">{displayName}</span>
        </div>
      </div>
    </header>
  );
}

export const CRM_TOPNAV_PATHS: readonly string[] = [
  ROUTES.dashboard,
  ROUTES.opportunities,
  ROUTES.dealsAlias,
  ROUTES.inbox,
  ROUTES.calendar,
  ROUTES.tasks,
  ROUTES.monthlyScorecard,
  ROUTES.settings,
];

export { usesHubAdminShell, usesHubAdminShell as usesCrmTopNav } from '../../config/hubAdminPaths.js';
