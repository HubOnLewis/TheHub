import { computeReadiness } from '../readiness.js';
import { usePortalStore } from '../portalStore.js';

export default function PeaceOfMindBanner() {
  const event = usePortalStore(s => s.event);
  const { peaceHeadline, peaceDetail, score } = computeReadiness(event);

  return (
    <div className={`portal-peace${score < 70 ? ' portal-peace--warn' : ''}`}>
      <h2>{peaceHeadline}</h2>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--portal-muted)' }}>{peaceDetail}</p>
    </div>
  );
}
