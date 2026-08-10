import { useParams } from 'react-router-dom';
import { useDeal } from '../hooks/useDeal.js';
import { DealDetailLiveShell } from './deal/DealDetailLive.js';

/**
 * Event detail — always prefers live CRM record (API / screenshot store).
 * Reference Perfect Venue seed ids fall back inside DealDetailLiveShell.
 * Demo flagship chrome was removed so new bookings no longer inherit Miller/Harris copy.
 */
export default function DealDetail() {
  const { dealId } = useParams<{ dealId: string }>();
  const { data: apiDeal, isLoading, isError } = useDeal(dealId);

  return (
    <DealDetailLiveShell
      isLoading={isLoading}
      isError={isError}
      deal={apiDeal as Record<string, unknown> | undefined}
    />
  );
}
