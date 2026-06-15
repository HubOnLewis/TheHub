import { lazy, Suspense } from 'react';
import { isProductionCRM } from '../config/productionData.js';
import DealsLive from './deals/DealsLive.js';

const DealsDemo = lazy(() => import('./deals/DealsDemo.js'));

export default function Deals() {
  if (isProductionCRM()) return <DealsLive />;
  return (
    <Suspense fallback={null}>
      <DealsDemo />
    </Suspense>
  );
}