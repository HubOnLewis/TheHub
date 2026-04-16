import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { useAppStore } from './store/index.js';
import Login         from './pages/Login.js';
import Dashboard     from './pages/Dashboard.js';
import Leads         from './pages/Leads.js';
import Deals         from './pages/Deals.js';
import Units         from './pages/Units.js';
import Admin         from './pages/Admin.js';
import Companies     from './pages/Companies.js';
import CompanyDetail from './pages/CompanyDetail.js';

function Shell() {
  const { user, logout } = useAppStore();

  return (
    <div className="app-shell">
      <nav className="sidebar">
        <div className="sidebar-logo">
          <h1>MTTE CORE</h1>
          <p>{user?.entity} · {user?.location}</p>
        </div>
        <div className="sidebar-nav">
          {[
            { to: '/dashboard', label: 'Dashboard' },
            { to: '/leads',     label: 'Leads' },
            { to: '/deals',     label: 'Deals' },
            { to: '/units',     label: 'Units' },
            { to: '/companies', label: 'Companies' },
          ].map(l => (
            <NavLink key={l.to} to={l.to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              {l.label}
            </NavLink>
          ))}
          {(user?.role === 'admin' || user?.role === 'super_admin') && (
            <NavLink to="/admin" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              Admin
            </NavLink>
          )}
        </div>
        <div style={{ padding: '14px 18px', borderTop: '1px solid #2d3140' }}>
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>{user?.name}</div>
          <button className="btn btn-ghost" style={{ color: '#9ca3af', padding: '4px 0', fontSize: 12 }} onClick={logout}>
            Sign out
          </button>
        </div>
      </nav>
      <div className="main-area">
        <header className="topbar">
          <span style={{ fontFamily: 'var(--font-cond)', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 13, letterSpacing: '0.5px' }}>
            {user?.role?.toUpperCase()}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-light)' }}>{user?.tenantId}</span>
        </header>
        <main className="page-content">
          <Routes>
            <Route path="/dashboard"       element={<Dashboard />} />
            <Route path="/leads"           element={<Leads />} />
            <Route path="/deals"           element={<Deals />} />
            <Route path="/units"           element={<Units />} />
            <Route path="/admin"           element={<Admin />} />
            <Route path="/companies"       element={<Companies />} />
            <Route path="/companies/:id"   element={<CompanyDetail />} />
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
