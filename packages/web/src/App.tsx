import { useLayoutEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { useAppStore } from './store/index.js';
import { NavIcons } from './components/NavIcons.js';
import { HUB_LABELS, roleForDisplay } from '@hub-crm/shared';
import { ROUTES, CLIENT_SIMPLE_PATHS } from './config/paths.js';
import LegacyModuleGate from './components/LegacyModuleGate.js';
import Login         from './pages/Login.js';
import Dashboard     from './pages/Dashboard.js';
import Leads         from './pages/Leads.js';
import Deals         from './pages/Deals.js';
import Units         from './pages/Units.js';
import Admin         from './pages/Admin.js';
import Companies     from './pages/Companies.js';
import CompanyDetail from './pages/CompanyDetail.js';
import MyWork        from './pages/MyWork.js';
import FollowUps     from './pages/FollowUps.js';
import PipelinePressure from './pages/PipelinePressure.js';
import ForecastReview from './pages/ForecastReview.js';
import RepScorecards from './pages/RepScorecards.js';
import WeeklyCadence from './pages/WeeklyCadence.js';
import AccountCoverage from './pages/AccountCoverage.js';
import AccountExpansion from './pages/AccountExpansion.js';
import Builds from './pages/Builds.js';
import Production from './pages/Production.js';
import Delivery from './pages/Delivery.js';
import TasksCenter from './pages/TasksCenter.js';
import CalendarOccupancy from './pages/CalendarOccupancy.js';
import DealDetail from './pages/DealDetail.js';
import InboxPage from './pages/InboxPage.js';
import SettingsLayout, { SettingsIndexRedirect } from './pages/settings/SettingsLayout.js';
import SettingsModulePage from './pages/settings/SettingsModulePage.js';
import AutopilotPage from './pages/AutopilotPage.js';
import OwnerBriefing from './pages/OwnerBriefing.js';
import TodayOperations from './pages/TodayOperations.js';
import RevenueLeaks from './pages/RevenueLeaks.js';
import AutomationImpact from './pages/AutomationImpact.js';
import { isScreenshotMode } from './config/screenshotMode.js';
import { getScreenshotDemoUser, SCREENSHOT_DEMO_TOKEN } from './config/screenshotSession.js';
import TopbarStatus from './components/TopbarStatus.js';
import ThemeFooterToggle from './components/ThemeFooterToggle.js';
import DemoOpsInit from './components/demo/DemoOpsInit.js';
import OperationalRail from './components/demo/OperationalRail.js';
import DemoToastStack from './components/demo/DemoToastStack.js';
import { isDeployedAlpha } from './config/alphaPresentation.js';
import { isProductionCRM, PRODUCTION_HIDDEN_MAIN_NAV } from './config/productionData.js';
import ProductionModuleGate from './components/ProductionModuleGate.js';
import UserManagement from './pages/UserManagement.js';
import ReviewNotes from './pages/ReviewNotes.js';
import AuditTrail from './pages/AuditTrail.js';
import BrandLogo from './components/BrandLogo.js';
import { BRAND } from './branding/tokens.js';
import PortalRoutes from './portal/PortalRoutes.js';
import PrivacyPage from './pages/legal/PrivacyPage.js';
import TermsPage from './pages/legal/TermsPage.js';
import ReferralRedirect from './pages/ReferralRedirect.js';
import ProspectsPage from './pages/ProspectsPage.js';
import MarketingPage from './pages/MarketingPage.js';
import ReferralsPage from './pages/ReferralsPage.js';
import MonthlyScorecardPage from './pages/MonthlyScorecardPage.js';
import AnalyticsRouteTracker from './components/AnalyticsRouteTracker.js';
import LegalFooterLinks from './components/LegalFooterLinks.js';
import ClientReviewBanner from './components/ClientReviewBanner.js';
import HubAdminShell from './components/layout/HubAdminShell.js';
import { usesHubAdminShell } from './config/hubAdminPaths.js';
import { resolveHubRouteElement } from './components/routing/GatedHubRoute.js';
import { withLiveModuleBoundary } from './components/live/LiveModuleErrorBoundary.js';

type NavItem = { to: string; label: string; icon: ReactNode; aliasPrefixes?: string[]; matchPrefix?: string };

/** Client-demo primary navigation */
const NAV_MAIN: NavItem[] = [
  { to: ROUTES.dashboard, label: 'Dashboard', icon: NavIcons.dashboard },
  { to: ROUTES.leads, label: 'Leads & Prospects', icon: NavIcons.leads, aliasPrefixes: [ROUTES.prospects] },
  { to: ROUTES.opportunities, label: 'Events', icon: NavIcons.deals, aliasPrefixes: [ROUTES.dealsAlias] },
  { to: ROUTES.marketing, label: 'Marketing', icon: NavIcons.forecast, aliasPrefixes: [ROUTES.marketingBlasts] },
  { to: ROUTES.referrals, label: 'Referrals', icon: NavIcons.followups },
  { to: ROUTES.monthlyScorecard, label: 'Monthly Scorecard', icon: NavIcons.scorecards },
];

/** Admin / internal tools — collapsed under “More” */
const NAV_INTERNAL: NavItem[] = [
  { to: ROUTES.today, label: 'Today', icon: NavIcons.today },
  { to: ROUTES.inbox, label: 'Inbox', icon: NavIcons.inbox },
  { to: ROUTES.calendar, label: 'Calendar', icon: NavIcons.calendar },
  { to: ROUTES.accounts, label: HUB_LABELS.accounts, icon: NavIcons.companies, aliasPrefixes: [ROUTES.companiesAlias] },
  { to: ROUTES.followUps, label: HUB_LABELS.followUps, icon: NavIcons.followups },
  { to: ROUTES.autopilot, label: 'Autopilot', icon: NavIcons.autopilot },
  { to: ROUTES.tasks, label: 'Tasks', icon: NavIcons.tasks },
  { to: ROUTES.audit, label: 'Audit trail', icon: NavIcons.audit },
];

const NAV_SETTINGS: NavItem = { to: ROUTES.settings, label: 'Settings', icon: NavIcons.settings, matchPrefix: ROUTES.settings };

function isSimpleClientPath(pathname: string): boolean {
  return CLIENT_SIMPLE_PATHS.some(
    p => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function navLinkClass(to: string, aliasPrefixes: string[] | undefined, pathname: string, matchPrefix?: string): string {
  if (matchPrefix) {
    const active = pathname === matchPrefix || pathname.startsWith(`${matchPrefix}/`);
    return `nav-link${active ? ' active' : ''}`;
  }
  const bases = [to, ...(aliasPrefixes ?? [])];
  const active = bases.some(base => pathname === base || pathname.startsWith(`${base}/`));
  return `nav-link${active ? ' active' : ''}`;
}

function NavLinks({
  items,
  pathname,
  collapsed,
}: {
  items: NavItem[];
  pathname: string;
  collapsed: boolean;
}) {
  return items.map(l => (
    <NavLink
      key={l.to}
      to={l.to}
      className={() => navLinkClass(l.to, l.aliasPrefixes, pathname, l.matchPrefix)}
      title={collapsed ? l.label : undefined}
    >
      <span className="nav-icon">{l.icon}</span>
      <span className="nav-label">{l.label}</span>
    </NavLink>
  ));
}

function Shell() {
  const { pathname } = useLocation();
  const { user, logout, theme: themeRaw, sidebarCollapsed, setSidebarCollapsed } = useAppStore();
  const theme = themeRaw === 'light' ? 'light' : 'dark';
  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isDashboard = pathname === ROUTES.dashboard || pathname === `${ROUTES.dashboard}/`;
  const hubShell = usesHubAdminShell(pathname);

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const navMain = isProductionCRM()
    ? NAV_MAIN.filter(item => !PRODUCTION_HIDDEN_MAIN_NAV.has(item.to))
    : NAV_MAIN;

  // More tools: admin-only, collapsed by default — opens only when user clicks or is on an internal route
  useLayoutEffect(() => {
    if (isProductionCRM()) return;
    const onInternal = NAV_INTERNAL.some(l =>
      navLinkClass(l.to, l.aliasPrefixes, pathname, l.matchPrefix).includes('active'),
    );
    if (onInternal) setMoreOpen(true);
  }, [pathname]);

  useLayoutEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  return (
    <div
      className={`app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}${mobileNavOpen ? ' mobile-nav-open' : ''}${isDashboard ? ' app-shell--dashboard' : ''}${hubShell ? ' app-shell--hub-admin app-shell--crm-topnav' : ''}`}
    >
      {!hubShell && mobileNavOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}
      {!hubShell ? (
      <nav className="sidebar sidebar--premium" aria-label="Main navigation">
        <div className="sidebar-logo">
          <div className="sidebar-brand-block">
            <div className="sidebar-brand-block__frame">
              <BrandLogo
                size={sidebarCollapsed ? 'md' : 'hero'}
                className="sidebar-brand-block__logo"
              />
            </div>
            {!sidebarCollapsed && (
              <div className="sidebar-brand-block__copy">
                <p className="sidebar-brand-block__os">{BRAND.productSubtitle}</p>
                <p className="sidebar-brand-block__venue">
                  {BRAND.venueName} · {BRAND.venueLocation}
                </p>
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-ghost sidebar-toggle"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          {sidebarCollapsed ? '»' : '«'} {!sidebarCollapsed && 'Menu'}
        </button>
        <div className="sidebar-nav">
          {!sidebarCollapsed && <span className="nav-section-label">Main</span>}
          <NavLinks items={navMain} pathname={pathname} collapsed={sidebarCollapsed} />
          {isAdmin && !sidebarCollapsed && !isProductionCRM() && (
            <>
              <button
                type="button"
                className="sidebar-more-toggle"
                onClick={() => setMoreOpen(v => !v)}
                aria-expanded={moreOpen}
              >
                <span className="nav-icon">⋯</span>
                <span className="nav-label">More tools</span>
              </button>
              {moreOpen ? (
                <div className="sidebar-more-panel">
                  <NavLinks items={NAV_INTERNAL} pathname={pathname} collapsed={false} />
                </div>
              ) : null}
            </>
          )}
          {!sidebarCollapsed && <span className="nav-section-label">Admin</span>}
          <NavLink
            to={NAV_SETTINGS.to}
            className={() => navLinkClass(NAV_SETTINGS.to, NAV_SETTINGS.aliasPrefixes, pathname, NAV_SETTINGS.matchPrefix)}
            title={sidebarCollapsed ? NAV_SETTINGS.label : undefined}
          >
            <span className="nav-icon">{NAV_SETTINGS.icon}</span>
            <span className="nav-label">{NAV_SETTINGS.label}</span>
          </NavLink>
          {isAdmin && (
            <NavLink
              to={ROUTES.admin}
              className={() => navLinkClass(ROUTES.admin, undefined, pathname)}
              title={sidebarCollapsed ? HUB_LABELS.adminWorkspace : undefined}
            >
              <span className="nav-icon">{NavIcons.admin}</span>
              <span className="nav-label">{HUB_LABELS.adminWorkspace}</span>
            </NavLink>
          )}
        </div>
        <div className="sidebar-footer">
          {!sidebarCollapsed && (
            <div className="sidebar-user">
              <div className="sidebar-user__name">{user?.name}</div>
              <div className="sidebar-user__email">{user?.email}</div>
            </div>
          )}
          {!sidebarCollapsed && <LegalFooterLinks className="sidebar-legal-links" showContact={false} />}
          <ThemeFooterToggle collapsed={sidebarCollapsed} />
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: sidebarCollapsed ? '6px' : '4px 0', fontSize: 12, width: sidebarCollapsed ? '100%' : 'auto' }}
            onClick={logout}
            title="Sign out"
          >
            {sidebarCollapsed ? '⎋' : 'Sign out'}
          </button>
        </div>
      </nav>
      ) : null}
      {hubShell ? (
        <HubAdminShell
          mobileNavOpen={mobileNavOpen}
          setMobileNavOpen={setMobileNavOpen}
          onLogout={logout}
        >
          {!isDeployedAlpha() && <DemoOpsInit />}
          {!isDeployedAlpha() && <DemoToastStack />}
          <Routes>
            <Route path={ROUTES.dashboard} element={resolveHubRouteElement(ROUTES.dashboard, withLiveModuleBoundary('Home', <Dashboard />))} />
            <Route path={ROUTES.today} element={resolveHubRouteElement(ROUTES.today, <TodayOperations />, 'Today')} />
            <Route path={ROUTES.ownerBriefing} element={resolveHubRouteElement(ROUTES.ownerBriefing, <OwnerBriefing />, 'Owner briefing')} />
            <Route path={ROUTES.revenueLeaks} element={resolveHubRouteElement(ROUTES.revenueLeaks, <RevenueLeaks />, 'Revenue leaks')} />
            <Route path={ROUTES.automationImpact} element={resolveHubRouteElement(ROUTES.automationImpact, <AutomationImpact />, 'Automation impact')} />
            <Route path={ROUTES.autopilot} element={resolveHubRouteElement(ROUTES.autopilot, <AutopilotPage />, 'Autopilot')} />
            <Route path={ROUTES.inbox} element={resolveHubRouteElement(ROUTES.inbox, withLiveModuleBoundary('Inbox', <InboxPage />))} />
            <Route path={ROUTES.calendar} element={resolveHubRouteElement(ROUTES.calendar, withLiveModuleBoundary('Calendar', <CalendarOccupancy />))} />
            <Route path={ROUTES.tasks} element={resolveHubRouteElement(ROUTES.tasks, withLiveModuleBoundary('Tasks', <TasksCenter />))} />
            <Route path={ROUTES.settings} element={<SettingsLayout />}>
              <Route index element={<SettingsIndexRedirect />} />
              <Route path=":moduleId" element={<SettingsModulePage />} />
            </Route>
            <Route path={ROUTES.leads} element={resolveHubRouteElement(ROUTES.leads, <Leads />)} />
            <Route path={`${ROUTES.opportunities}/:dealId`} element={<DealDetail />} />
            <Route path={`${ROUTES.dealsAlias}/:dealId`} element={<DealDetail />} />
            <Route path={ROUTES.dealsAlias} element={resolveHubRouteElement(ROUTES.dealsAlias, <Deals />)} />
            <Route path={ROUTES.opportunities} element={resolveHubRouteElement(ROUTES.opportunities, <Deals />)} />
            <Route path={ROUTES.userManagement} element={resolveHubRouteElement(ROUTES.userManagement, <UserManagement />)} />
            <Route path={ROUTES.audit} element={resolveHubRouteElement(ROUTES.audit, <AuditTrail />, 'Audit trail')} />
            <Route path={ROUTES.admin} element={resolveHubRouteElement(ROUTES.admin, <Admin />)} />
            <Route path={ROUTES.accounts} element={resolveHubRouteElement(ROUTES.accounts, <Companies />, HUB_LABELS.accounts)} />
            <Route path={ROUTES.companiesAlias} element={resolveHubRouteElement(ROUTES.companiesAlias, <Companies />, HUB_LABELS.accounts)} />
            <Route path={`${ROUTES.accounts}/:id`} element={<CompanyDetail />} />
            <Route path={`${ROUTES.companiesAlias}/:id`} element={<CompanyDetail />} />
            <Route path={ROUTES.myWork} element={resolveHubRouteElement(ROUTES.myWork, <MyWork />, 'My work')} />
            <Route path={ROUTES.followUps} element={resolveHubRouteElement(ROUTES.followUps, <FollowUps />, HUB_LABELS.followUps)} />
            <Route path={ROUTES.prospects} element={resolveHubRouteElement(ROUTES.prospects, <ProspectsPage />)} />
            <Route path={ROUTES.marketing} element={resolveHubRouteElement(ROUTES.marketing, <MarketingPage />, 'Marketing')} />
            <Route path={ROUTES.referrals} element={resolveHubRouteElement(ROUTES.referrals, <ReferralsPage />, 'Referrals')} />
            <Route path={ROUTES.monthlyScorecard} element={resolveHubRouteElement(ROUTES.monthlyScorecard, withLiveModuleBoundary('Reports', <MonthlyScorecardPage />))} />
            <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
          </Routes>
        </HubAdminShell>
      ) : (
      <div className="main-area">
        <header className={`topbar${isDashboard ? ' topbar--slim' : ''}`}>
          <button
            type="button"
            className="topbar-menu-btn"
            aria-label="Open navigation"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen(v => !v)}
          >
            ☰
          </button>
          <TopbarStatus slim={isDashboard} />
          <div className="topbar-actions">
            <span className="topbar-role">{user?.role ? roleForDisplay(user.role) : ''}</span>
          </div>
        </header>
        {!isDeployedAlpha() && <ClientReviewBanner />}
        <main className={`page-content${isDashboard ? ' page-content--dashboard' : ''}`}>
          {!isDeployedAlpha() && <DemoOpsInit />}
          {!isDeployedAlpha() && !isDashboard && !isSimpleClientPath(pathname) && <OperationalRail />}
          {!isDeployedAlpha() && <DemoToastStack />}
          <Routes>
            <Route path={ROUTES.dashboard} element={<Dashboard />} />
            <Route path={ROUTES.today} element={<ProductionModuleGate moduleLabel="Today"><TodayOperations /></ProductionModuleGate>} />
            <Route path={ROUTES.ownerBriefing} element={<ProductionModuleGate moduleLabel="Owner briefing"><OwnerBriefing /></ProductionModuleGate>} />
            <Route path={ROUTES.revenueLeaks} element={<ProductionModuleGate moduleLabel="Revenue leaks"><RevenueLeaks /></ProductionModuleGate>} />
            <Route path={ROUTES.automationImpact} element={<ProductionModuleGate moduleLabel="Automation impact"><AutomationImpact /></ProductionModuleGate>} />
            <Route path={ROUTES.autopilot} element={<ProductionModuleGate moduleLabel="Autopilot"><AutopilotPage /></ProductionModuleGate>} />
            <Route path={ROUTES.inbox} element={<ProductionModuleGate moduleLabel="Inbox"><InboxPage /></ProductionModuleGate>} />
            <Route path={ROUTES.calendar} element={<ProductionModuleGate moduleLabel="Calendar"><CalendarOccupancy /></ProductionModuleGate>} />
            <Route path={ROUTES.tasks} element={<ProductionModuleGate moduleLabel="Tasks"><TasksCenter /></ProductionModuleGate>} />
            <Route path={ROUTES.settings} element={<SettingsLayout />}>
              <Route index element={<SettingsIndexRedirect />} />
              <Route path=":moduleId" element={<SettingsModulePage />} />
            </Route>
            <Route path={ROUTES.leads} element={<Leads />} />
            <Route path={`${ROUTES.opportunities}/:dealId`} element={<DealDetail />} />
            <Route path={`${ROUTES.dealsAlias}/:dealId`} element={<DealDetail />} />
            <Route path={ROUTES.dealsAlias} element={<Deals />} />
            <Route path={ROUTES.opportunities} element={<Deals />} />
            <Route path={ROUTES.bookingsLegacy} element={<LegacyModuleGate module="bookings"><Units /></LegacyModuleGate>} />
            <Route path={ROUTES.bookings} element={<LegacyModuleGate module="bookings"><Units /></LegacyModuleGate>} />
            <Route path={ROUTES.proposalsLegacy} element={<LegacyModuleGate module="builds"><Builds /></LegacyModuleGate>} />
            <Route path={ROUTES.proposals} element={<LegacyModuleGate module="builds"><Builds /></LegacyModuleGate>} />
            <Route path={ROUTES.fulfillmentLegacy} element={<LegacyModuleGate module="fulfillment"><Production /></LegacyModuleGate>} />
            <Route path={ROUTES.fulfillment} element={<LegacyModuleGate module="fulfillment"><Production /></LegacyModuleGate>} />
            <Route path={ROUTES.closeoutLegacy} element={<LegacyModuleGate module="closeout"><Delivery /></LegacyModuleGate>} />
            <Route path={ROUTES.closeout} element={<LegacyModuleGate module="closeout"><Delivery /></LegacyModuleGate>} />
            <Route path={ROUTES.userManagement} element={<UserManagement />} />
            <Route path={ROUTES.reviewNotes} element={<ReviewNotes />} />
            <Route path={ROUTES.audit} element={<ProductionModuleGate moduleLabel="Audit trail"><AuditTrail /></ProductionModuleGate>} />
            <Route path={ROUTES.admin} element={<Admin />} />
            <Route path={ROUTES.accounts} element={<ProductionModuleGate moduleLabel={HUB_LABELS.accounts}><Companies /></ProductionModuleGate>} />
            <Route path={ROUTES.companiesAlias} element={<ProductionModuleGate moduleLabel={HUB_LABELS.accounts}><Companies /></ProductionModuleGate>} />
            <Route path={`${ROUTES.accounts}/:id`} element={<CompanyDetail />} />
            <Route path={`${ROUTES.companiesAlias}/:id`} element={<CompanyDetail />} />
            <Route path={ROUTES.myWork} element={<ProductionModuleGate moduleLabel="My work"><MyWork /></ProductionModuleGate>} />
            <Route path={ROUTES.followUps} element={<ProductionModuleGate moduleLabel={HUB_LABELS.followUps}><FollowUps /></ProductionModuleGate>} />
            <Route path={ROUTES.pipeline} element={<ProductionModuleGate moduleLabel="Pipeline pressure"><PipelinePressure /></ProductionModuleGate>} />
            <Route path={ROUTES.insights} element={<ProductionModuleGate moduleLabel="Forecast review"><ForecastReview /></ProductionModuleGate>} />
            <Route path={ROUTES.repScorecards} element={<ProductionModuleGate moduleLabel="Rep scorecards"><RepScorecards /></ProductionModuleGate>} />
            <Route path={ROUTES.weeklyCadence} element={<ProductionModuleGate moduleLabel="Weekly cadence"><WeeklyCadence /></ProductionModuleGate>} />
            <Route path={ROUTES.accountCoverage} element={<ProductionModuleGate moduleLabel="Account coverage"><AccountCoverage /></ProductionModuleGate>} />
            <Route path={ROUTES.accountExpansion} element={<ProductionModuleGate moduleLabel="Account expansion"><AccountExpansion /></ProductionModuleGate>} />
            <Route path={ROUTES.prospects} element={<ProspectsPage />} />
            <Route path={ROUTES.marketing} element={<ProductionModuleGate moduleLabel="Marketing"><MarketingPage /></ProductionModuleGate>} />
            <Route path={ROUTES.marketingBlasts} element={<Navigate to={ROUTES.marketing} replace />} />
            <Route path={ROUTES.referrals} element={<ProductionModuleGate moduleLabel="Referrals"><ReferralsPage /></ProductionModuleGate>} />
            <Route path={ROUTES.monthlyScorecard} element={<ProductionModuleGate moduleLabel="Monthly scorecard"><MonthlyScorecardPage /></ProductionModuleGate>} />
            <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
          </Routes>
        </main>
      </div>
      )}
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const login = useAppStore(s => s.login);
  const user = useAppStore(s => s.user);

  if (isScreenshotMode() && !useAppStore.getState().user) {
    login(getScreenshotDemoUser(), SCREENSHOT_DEMO_TOKEN);
    useAppStore.getState().setTheme('light');
  }

  const sessionUser = useAppStore.getState().user;
  return sessionUser || user ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppRouter() {
  return (
    <>
      <AnalyticsRouteTracker />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path={ROUTES.privacy} element={<PrivacyPage />} />
        <Route path={ROUTES.terms} element={<TermsPage />} />
        <Route path="/r/:referralCode" element={<ReferralRedirect />} />
        <Route path="/portal/*" element={<PortalRoutes />} />
        <Route path="/*" element={<RequireAuth><Shell /></RequireAuth>} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppRouter />
    </BrowserRouter>
  );
}
