import { lazy, Suspense } from 'react';
import { isProductionCRM } from '../config/productionData.js';
import LeadsLive from './leads/LeadsLive.js';

const LeadsDemo = lazy(() => import('./leads/LeadsDemo.js'));

export default function Leads() {
  if (isProductionCRM()) return <LeadsLive />;
  return (
    <Suspense fallback={null}>
      <LeadsDemo />
    </Suspense>
  );
}