import { useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { isScreenshotMode } from '../config/screenshotMode.js';
import PortalShell from './components/PortalShell.js';
import { PORTAL_ROUTES } from './paths.js';
import { PORTAL_NESTED } from './portalNestedPaths.js';
import PortalLogin from './pages/PortalLogin.js';
import PortalDashboard from './pages/PortalDashboard.js';
import PortalEvent from './pages/PortalEvent.js';
import PortalPayments from './pages/PortalPayments.js';
import PortalDocuments from './pages/PortalDocuments.js';
import PortalMessages from './pages/PortalMessages.js';
import PortalTimeline from './pages/PortalTimeline.js';
import PortalChecklist from './pages/PortalChecklist.js';
import PortalGuests from './pages/PortalGuests.js';
import PortalDetails from './pages/PortalDetails.js';
import PortalDesignBoard from './pages/PortalDesignBoard.js';
import PortalSettings from './pages/PortalSettings.js';
import { usePortalStore, PORTAL_DEMO_SESSION } from './portalStore.js';

function RequirePortalAuth({ children }: { children: ReactNode }) {
  const session = usePortalStore(s => s.session);
  const login = usePortalStore(s => s.login);

  useEffect(() => {
    if (isScreenshotMode() && !usePortalStore.getState().session) {
      login(PORTAL_DEMO_SESSION.user);
    }
  }, [login]);

  const active = usePortalStore.getState().session ?? session;
  // Absolute Navigate destination — preserves public URL contract `/portal/login`
  return active ? <>{children}</> : <Navigate to={PORTAL_ROUTES.login} replace />;
}

/**
 * Nested under App `<Route path="/portal/*" />` with `v7_relativeSplatPath`.
 * Child paths MUST be relative to the splat remainder (e.g. `login`, not `/portal/login`).
 */
export default function PortalRoutes() {
  return (
    <Routes>
      <Route path={PORTAL_NESTED.login} element={<PortalLogin />} />
      <Route index element={<Navigate to={PORTAL_ROUTES.login} replace />} />
      <Route
        element={
          <RequirePortalAuth>
            <PortalShell />
          </RequirePortalAuth>
        }
      >
        <Route path={PORTAL_NESTED.dashboard} element={<PortalDashboard />} />
        <Route path={PORTAL_NESTED.event} element={<PortalEvent />} />
        <Route path={PORTAL_NESTED.payments} element={<PortalPayments />} />
        <Route path={PORTAL_NESTED.documents} element={<PortalDocuments />} />
        <Route path={PORTAL_NESTED.messages} element={<PortalMessages />} />
        <Route path={PORTAL_NESTED.timeline} element={<PortalTimeline />} />
        <Route path={PORTAL_NESTED.checklist} element={<PortalChecklist />} />
        <Route path={PORTAL_NESTED.guests} element={<PortalGuests />} />
        <Route path={PORTAL_NESTED.details} element={<PortalDetails />} />
        <Route path={PORTAL_NESTED.designBoard} element={<PortalDesignBoard />} />
        <Route path={PORTAL_NESTED.settings} element={<PortalSettings />} />
      </Route>
      <Route path="*" element={<Navigate to={PORTAL_ROUTES.login} replace />} />
    </Routes>
  );
}
