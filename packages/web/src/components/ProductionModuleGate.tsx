import { Link } from 'react-router-dom';
import { isProductionCRM } from '../config/productionData.js';
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
        <span className="page-kicker">Internal preview</span>
        <h2 className="page-section__title" style={{ marginTop: 6 }}>{moduleLabel ?? 'Preview module'}</h2>
        <p className="text-sm text-muted" style={{ marginTop: 10, maxWidth: 620 }}>
          This workspace is intentionally withheld from the client-review navigation until its production data connection is complete.
        </p>
        <Link to={ROUTES.today} className="btn btn-primary" style={{ marginTop: 18 }}>
          Return to Today
        </Link>
      </div>
    </div>
  );
}