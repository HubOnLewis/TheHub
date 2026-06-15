import { Link } from 'react-router-dom';
import { EMPTY_LIVE_MESSAGE, isProductionCRM } from '../config/productionData.js';
import { ROUTES } from '../config/paths.js';

type Props = {
  children: React.ReactNode;
  moduleLabel?: string;
};

/** In production, block demo/static intel modules with an honest empty state. */
export default function ProductionModuleGate({ children, moduleLabel }: Props) {
  if (!isProductionCRM()) return <>{children}</>;

  return (
    <div className="page-simple">
      <div className="card page-section" style={{ padding: 24 }}>
        <h2 className="page-section__title">{moduleLabel ?? 'Module unavailable'}</h2>
        <p className="empty-hint">{EMPTY_LIVE_MESSAGE}</p>
        <p className="text-sm text-muted" style={{ marginTop: 8 }}>
          This area is not connected to live CRM data in the production alpha yet.
        </p>
        <Link to={ROUTES.dashboard} className="btn btn-secondary" style={{ marginTop: 16 }}>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}