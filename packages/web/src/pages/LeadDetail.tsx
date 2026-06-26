import { isProductionCRM } from '../config/productionData.js';
import LeadDetailLive from './leads/LeadDetailLive.js';

export default function LeadDetail() {
  if (isProductionCRM()) return <LeadDetailLive />;
  return <LeadDetailLive />;
}
