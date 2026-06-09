import { useQuery } from '@tanstack/react-query';
import client from '../api/client.js';

export function useDeal(id: string | undefined) {
  return useQuery({
    queryKey: ['deal', id],
    queryFn: () => client.get<Record<string, unknown>>(`/deals/${id}`).then(r => r.data),
    enabled: !!id,
    retry: 1,
  });
}
