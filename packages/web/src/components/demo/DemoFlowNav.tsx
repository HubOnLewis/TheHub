import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { isInternalDemoChromeEnabled } from '../../config/demoChrome.js';
import { ROUTES } from '../../config/paths.js';

const STORAGE_COLLAPSED = 'hub-crm-demo-flow-collapsed';

/** Client meeting walkthrough — keep in sync with docs/HUB_CLIENT_DEMO_RUNBOOK.md */
export const DEMO_WALKTHROUGH_SEQUENCE: Array<{ path: string; label: string; match?: (p: string) => boolean }> = [
  { path: ROUTES.dashboard, label: 'Dashboard' },
  { path: ROUTES.today, label: 'Today' },
  { path: ROUTES.ownerBriefing, label: 'Owner briefing' },
  { path: ROUTES.revenueLeaks, label: 'Revenue leaks' },
  { path: ROUTES.autopilot, label: 'Autopilot' },
  {
    path: `${ROUTES.opportunities}/pv-miller-harris`,
    label: 'Miller/Harris opportunity',
    match: p => p.includes('pv-miller-harris'),
  },
  { path: ROUTES.audit, label: 'Audit trail' },
  { path: ROUTES.calendar, label: 'Calendar' },
  { path: ROUTES.inbox, label: 'Inbox' },
  { path: ROUTES.tasks, label: 'Tasks' },
  {
    path: ROUTES.userManagement,
    label: 'User management',
    match: p => p === ROUTES.userManagement || p.includes('/settings/user-management'),
  },
  {
    path: ROUTES.reviewNotes,
    label: 'Review notes',
    match: p => p === ROUTES.reviewNotes || p.includes('/settings/review-notes'),
  },
  {
    path: `${ROUTES.settings}/sms-notifications`,
    label: 'Settings · SMS',
    match: p =>
      p.includes('/settings/sms') ||
      p.includes('/settings/payments') ||
      p.includes('/settings/demo-controls'),
  },
];

function findStepIndex(pathname: string): number {
  for (let i = 0; i < DEMO_WALKTHROUGH_SEQUENCE.length; i++) {
    const s = DEMO_WALKTHROUGH_SEQUENCE[i];
    if (s.match?.(pathname)) return i;
    if (pathname === s.path || pathname.startsWith(`${s.path}/`)) return i;
  }
  return -1;
}

export default function DemoFlowNav() {
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_COLLAPSED) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_COLLAPSED, collapsed ? '1' : '0');
    } catch { /* ignore */ }
  }, [collapsed]);

  const idx = useMemo(() => findStepIndex(pathname), [pathname]);
  const onWalkthroughPage = idx >= 0;

  if (!isInternalDemoChromeEnabled()) return null;
  if (pathname === '/login' || pathname.startsWith('/login')) return null;
  if (!onWalkthroughPage && collapsed) return null;

  const current = idx >= 0 ? idx : 0;
  const step = DEMO_WALKTHROUGH_SEQUENCE[current];
  const next = DEMO_WALKTHROUGH_SEQUENCE[(current + 1) % DEMO_WALKTHROUGH_SEQUENCE.length];

  if (collapsed) {
    return (
      <button
        type="button"
        className="demo-flow-nav demo-flow-nav--collapsed"
        onClick={() => setCollapsed(false)}
        title="Expand walkthrough guide"
      >
        Guide · step {current + 1}/{DEMO_WALKTHROUGH_SEQUENCE.length}
      </button>
    );
  }

  return (
    <nav className="demo-flow-nav" aria-label="Client walkthrough guide">
      <div className="demo-flow-nav__main">
        <span className="demo-flow-nav__step">
          Step {current + 1} of {DEMO_WALKTHROUGH_SEQUENCE.length}
        </span>
        <strong className="demo-flow-nav__current">{step.label}</strong>
        <span className="demo-flow-nav__next-label">
          Next: {next.label}
        </span>
      </div>
      <div className="demo-flow-nav__actions">
        <Link to={next.path} className="demo-flow-nav__next btn btn-secondary btn-sm">
          Continue →
        </Link>
        {idx > 0 && (
          <Link
            to={DEMO_WALKTHROUGH_SEQUENCE[current - 1].path}
            className="btn btn-ghost btn-sm"
          >
            ← Back
          </Link>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm demo-flow-nav__collapse"
          onClick={() => setCollapsed(true)}
          aria-label="Collapse walkthrough guide"
        >
          Hide
        </button>
      </div>
    </nav>
  );
}
