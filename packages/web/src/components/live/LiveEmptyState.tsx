import { EMPTY_LIVE_MESSAGE } from '../../config/productionData.js';

export default function LiveEmptyState({ hint }: { hint?: string }) {
  return (
    <p className="empty-hint">
      {EMPTY_LIVE_MESSAGE}
      {hint ? ` ${hint}` : ''}
    </p>
  );
}