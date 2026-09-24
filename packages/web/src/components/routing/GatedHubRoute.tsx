import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import ProductionModuleGate from '../ProductionModuleGate.js';
import {
  isProductionAlphaRedirectPath,
  productionAlphaRedirectTarget,
} from '../../config/productionAlphaNav.js';
import { useAppStore } from '../../store/index.js';

/**
 * Build a Route `element` for hub shell pages.
 * React Router v6 requires direct <Route> children — do not wrap <Route> in custom components.
 */
export function resolveHubRouteElement(
  path: string,
  children: ReactNode,
  gateLabel?: string,
): ReactNode {
  return (
    <DeskRouteGate path={path} gateLabel={gateLabel}>
      {children}
    </DeskRouteGate>
  );
}

function DeskRouteGate({
  path,
  gateLabel,
  children,
}: {
  path: string;
  gateLabel?: string;
  children: ReactNode;
}) {
  const role = useAppStore(s => s.user?.role);
  if (isProductionAlphaRedirectPath(path, role)) {
    return <Navigate to={productionAlphaRedirectTarget(path)} replace />;
  }
  if (gateLabel != null) {
    return <ProductionModuleGate moduleLabel={gateLabel}>{children}</ProductionModuleGate>;
  }
  return <>{children}</>;
}
