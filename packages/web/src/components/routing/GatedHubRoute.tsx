import type { ReactNode } from 'react';
import { Navigate, Route } from 'react-router-dom';
import ProductionModuleGate from '../ProductionModuleGate.js';
import { ROUTES } from '../../config/paths.js';
import { isProductionCRM } from '../../config/productionData.js';
import { isProductionAlphaRedirectPath } from '../../config/productionAlphaNav.js';

type GatedRouteProps = {
  path: string;
  gateLabel?: string;
  children: ReactNode;
};

/** Production alpha: redirect unwired routes to Home; otherwise optional module gate. */
export function GatedHubRoute({ path, gateLabel, children }: GatedRouteProps) {
  if (isProductionAlphaRedirectPath(path)) {
    return <Route path={path} element={<Navigate to={ROUTES.dashboard} replace />} />;
  }

  const element =
    gateLabel != null ? (
      <ProductionModuleGate moduleLabel={gateLabel}>{children}</ProductionModuleGate>
    ) : (
      children
    );

  return <Route path={path} element={element} />;
}

/** Routes that stay open in production without a gate (live data pages). */
export function OpenHubRoute({ path, children }: { path: string; children: ReactNode }) {
  if (isProductionCRM() && isProductionAlphaRedirectPath(path)) {
    return <Route path={path} element={<Navigate to={ROUTES.dashboard} replace />} />;
  }
  return <Route path={path} element={children} />;
}
