import { useLayoutEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { useAppStore } from './store/index.js';
import { NavIcons } from './components/NavIcons.js';
import Login         from './pages/Login.js';
import Dashboard     from './pages/Dashboard.js';
import Leads         from './pages/Leads.js';
import Deals         from './pages/Deals.js';
import Units         from './pages/Units.js';
import Admin         from './pages/Admin.js';
import Companies     from './pages/Companies.js';
import CompanyDetail from './pages/CompanyDetail.js';
import MyWork        from './pages/MyWork.js';
import PipelinePressure from './pages/PipelinePressure.js';
import ForecastReview from './pages/ForecastReview.js';
import RepScorecards from './pages/RepScorecards.js';
import WeeklyCadence from './pages/WeeklyCadence.js';
import AccountCoverage from './pages/AccountCoverage.js';
import AccountExpansion from './pages/AccountExpansion.js';
import Builds from './pages/Builds.js';
import Production from './pages/Production.js';
import Delivery from './pages/Delivery.js';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: NavIcons.dashboard },
  { to: '/leads', label: 'Leads', icon: NavIcons.leads },
  { to: '/deals', label: 'Deals', icon: NavIcons.deals },
  { to: '/units', label: 'Units', icon: NavIcons.units },
  { to: '/builds', label: 'Builds', icon: NavIcons.builds },
  { to: '/production', label: 'Production', icon: NavIcons.production },
  { to: '/delivery', label: 'Delivery', icon: NavIcons.delivery },
  { to: '/companies', label: 'Companies', icon: NavIcons.companies },
  { to: '/my-work', label: 'My Work', icon: NavIcons.work },
  { to: '/pipeline-pressure', label: 'Pipeline Pressure', icon: NavIcons.pressure },
  { to: '/forecast-review', label: 'Forecast Review', icon: NavIcons.forecast },
  { to: '/rep-scorecards', label: 'Rep Scorecards', icon: NavIcons.scorecards },
  { to: '/weekly-cadence', label: 'Weekly Cadence', icon: NavIcons.cadence },
  { to: '/account-coverage', label: 'Account Coverage', icon: NavIcons.coverage },
  { to: '/account-expansion', label: 'Account Expansion', icon: NavIcons.expansion },
] as const;

function Shell() {
  const { user, logout, theme: themeRaw, setTheme, sidebarCollapsed, setSidebarCollapsed } = useAppStore();
  const theme = themeRaw === 'light' ? 'light' : 'dark';

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <div className={`app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <nav className="sidebar" aria-label="Main navigation">
        <div className="sidebar-logo">
          <h1>MTTE</h1>
          {!sidebarCollapsed && <p>{user?.entity} · {user?.location}</p>}
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
          {NAV.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              title={sidebarCollapsed ? l.label : undefined}
            >
              <span className="nav-icon">{l.icon}</span>
              <span className="nav-label">{l.label}</span>
            </NavLink>
          ))}
          {(user?.role === 'admin' || user?.role === 'super_admin') && (
            <NavLink
              to="/admin"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              title={sidebarCollapsed ? 'Admin' : undefined}
            >
              <span className="nav-icon">{NavIcons.admin}</span>
              <span className="nav-label">Admin</span>
            </NavLink>
          )}
        </div>
        <div className="sidebar-footer">
          {!sidebarCollapsed && <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 8 }}>{user?.name}</div>}
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
      <div className="main-area">
        <header className="topbar">
          <span style={{ fontFamily: 'var(--font-cond)', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 12, letterSpacing: '0.12em' }}>
            {user?.role?.replace(/_/g, ' ').toUpperCase()}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text-light)' }}>{user?.tenantId}</span>
            <button
              type="button"
              className="theme-toggle"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
          </div>
        </header>
        <main className="page-content">
          <Routes>
            <Route path="/dashboard"       element={<Dashboard />} />
            <Route path="/leads"           element={<Leads />} />
            <Route path="/deals"           element={<Deals />} />
            <Route path="/units"           element={<Units />} />
            <Route path="/builds"          element={<Builds />} />
            <Route path="/production"      element={<Production />} />
            <Route path="/delivery"        element={<Delivery />} />
            <Route path="/admin"           element={<Admin />} />
            <Route path="/companies"       element={<Companies />} />
            <Route path="/companies/:id"   element={<CompanyDetail />} />
            <Route path="/my-work"         element={<MyWork />} />
            <Route path="/pipeline-pressure" element={<PipelinePressure />} />
            <Route path="/forecast-review" element={<ForecastReview />} />
            <Route path="/rep-scorecards" element={<RepScorecards />} />
            <Route path="/weekly-cadence" element={<WeeklyCadence />} />
            <Route path="/account-coverage" element={<AccountCoverage />} />
            <Route path="/account-expansion" element={<AccountExpansion />} />
            <Route path="*"               element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAppStore();
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={<RequireAuth><Shell /></RequireAuth>} />
      </Routes>
    </BrowserRouter>
  );
}
