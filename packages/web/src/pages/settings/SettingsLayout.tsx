import { useState } from 'react';
import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../../store/index.js';
import PageIntro from '../../components/layout/PageIntro.js';

type SettingsGroup = {
  label: string;
  adminOnly?: boolean;
  collapsible?: boolean;
  modules: ReadonlyArray<{ id: string; label: string }>;
};

const SYSTEM_MODULE_IDS = new Set(['demo-controls', 'audit-trail', 'data-import']);

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    label: 'Team & Access',
    modules: [
      { id: 'team-access', label: 'Team access' },
      { id: 'user-management', label: 'User management' },
    ],
  },
  {
    label: 'Integrations',
    modules: [{ id: 'integrations', label: 'Integrations' }],
  },
  {
    label: 'Referrals',
    modules: [{ id: 'referrals', label: 'Referral program' }],
  },
  {
    label: 'Analytics',
    modules: [{ id: 'analytics', label: 'Analytics' }],
  },
  {
    label: 'System',
    adminOnly: true,
    collapsible: true,
    modules: [
      { id: 'demo-controls', label: 'Demo controls' },
      { id: 'audit-trail', label: 'Audit trail' },
      { id: 'data-import', label: 'Data import' },
    ],
  },
];

/** Flat list for module title lookup */
export const SETTINGS_MODULES = SETTINGS_GROUPS.flatMap(g => [...g.modules]);

function activeModuleId(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

export default function SettingsLayout() {
  const { pathname } = useLocation();
  const role = useAppStore(s => s.user?.role);
  const isAdmin = role === 'admin' || role === 'super_admin';
  const moduleId = activeModuleId(pathname);
  const [systemOpen, setSystemOpen] = useState(() => SYSTEM_MODULE_IDS.has(moduleId));

  return (
    <div className="page-simple">
      <PageIntro
        title="Settings"
        subtitle="Team, integrations, and venue configuration."
      />
      <div className="settings-shell">
        <nav className="settings-nav settings-nav--grouped" aria-label="Settings sections">
          {SETTINGS_GROUPS.filter(g => !g.adminOnly || isAdmin).map(group => {
            if (group.collapsible) {
              return (
                <div key={group.label} className="settings-nav-group settings-nav-group--collapsible">
                  <button
                    type="button"
                    className="settings-nav-group__toggle"
                    onClick={() => setSystemOpen(o => !o)}
                    aria-expanded={systemOpen}
                  >
                    {group.label}
                    <span className="settings-nav-group__chevron" aria-hidden>{systemOpen ? '▾' : '▸'}</span>
                  </button>
                  <p className="settings-nav-group__helper">
                    Admin tools for configuration and diagnostics
                  </p>
                  {systemOpen ? (
                    <div className="settings-nav-group__items">
                      {group.modules.map(m => (
                        <NavLink
                          key={m.id}
                          to={m.id}
                          className={({ isActive }) => (isActive ? 'active' : '')}
                        >
                          {m.label}
                        </NavLink>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            }

            return (
              <div key={group.label} className="settings-nav-group">
                <span className="settings-nav-group__label">{group.label}</span>
                {group.modules.map(m => (
                  <NavLink
                    key={m.id}
                    to={m.id}
                    className={({ isActive }) => (isActive ? 'active' : '')}
                  >
                    {m.label}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="settings-panel">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export function SettingsIndexRedirect() {
  return <Navigate to="team-access" replace />;
}
