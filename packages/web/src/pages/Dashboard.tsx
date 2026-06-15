import { lazy, Suspense } from 'react';
import { isProductionCRM } from '../config/productionData.js';
import DashboardLive from './dashboard/DashboardLive.js';

const DashboardDemo = lazy(() => import('./dashboard/DashboardDemo.js'));

export default function Dashboard() {
  if (isProductionCRM()) return <DashboardLive />;
  return (
    <Suspense fallback={null}>
      <DashboardDemo />
    </Suspense>
  );
}