import { useQuery } from '@tanstack/react-query';
import client from '../api/client.js';

/** Same CommunicationsService inbox triage the Activity page uses. */
export type InboxTriage = {
  unansweredMessages: Array<{ eventId: string; eventTitle: string; preview: string; at: string }>;
  unsignedProposals: Array<{ eventId: string; eventTitle: string; version: number; status: string }>;
  unpaidDeposits: Array<{ eventId: string; eventTitle: string; balanceDue: number }>;
  drafts?: unknown[];
  scheduled?: unknown[];
  templates?: Array<{ key: string; label: string }>;
};

export function useInboxTriage() {
  return useQuery({
    queryKey: ['comms', 'inbox'],
    queryFn: () => client.get<InboxTriage>('/comms/inbox').then(r => r.data),
    retry: false,
    staleTime: 15_000,
  });
}