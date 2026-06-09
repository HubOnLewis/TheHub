import { useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { isScreenshotMode } from '../config/screenshotMode.js';
import PortalShell from './components/PortalShell.js';
import { PORTAL_ROUTES } from './paths.js';
import PortalLogin from './pages/PortalLogin.js';
import PortalDashboard from './pages/PortalDashboard.js';
import PortalEvent from './pages/PortalEvent.js';
import PortalPayments from './pages/PortalPayments.js';
import PortalDocuments from './pages/PortalDocuments.js';
import PortalMessages from './pages/PortalMessages.js';
import PortalTimeline from './pages/PortalTimeline.js';
import PortalChecklist from './pages/PortalChecklist.js';
import PortalGuests from './pages/PortalGuests.js';
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
  return active ? <>{children}</> : <Navigate to={PORTAL_ROUTES.login} replace />;
}

export default function PortalRoutes() {
  return (
    <Routes>
      <Route path={PORTAL_ROUTES.login} element={<PortalLogin />} />
      <Route path="/" element={<Navigate to={PORTAL_ROUTES.dashboard} replace />} />
      <Route
        element={
          <RequirePortalAuth>
            <PortalShell />
          </RequirePortalAuth>
        }
      >
        <Route path="dashboard" element={<PortalDashboard />} />
        <Route path="event/:id" element={<PortalEvent />} />
        <Route path="payments" element={<PortalPayments />} />
        <Route path="documents" element={<PortalDocuments />} />
        <Route path="messages" element={<PortalMessages />} />
        <Route path="timeline" element={<PortalTimeline />} />
        <Route path="checklist" element={<PortalChecklist />} />
        <Route path="guests" element={<PortalGuests />} />
        <Route path="design-board" element={<PortalDesignBoard />} />
        <Route path="settings" element={<PortalSettings />} />
      </Route>
      <Route path="*" element={<Navigate to={PORTAL_ROUTES.login} replace />} />
    </Routes>
  );
}
