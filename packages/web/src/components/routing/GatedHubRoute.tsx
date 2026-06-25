import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import ProductionModuleGate from '../ProductionModuleGate.js';
import { ROUTES } from '../../config/paths.js';
import { isProductionAlphaRedirectPath } from '../../config/productionAlphaNav.js';

/**
 * Build a Route `element` for hub shell pages.
 * React Router v6 requires direct <Route> children — do not wrap <Route> in custom components.
 */
export function resolveHubRouteElement(
  path: string,
  children: ReactNode,
  gateLabel?: string,
): ReactNode {
  if (isProductionAlphaRedirectPath(path)) {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  if (gateLabel != null) {
    return <ProductionModuleGate moduleLabel={gateLabel}>{children}</ProductionModuleGate>;
  }

  return children;
}
