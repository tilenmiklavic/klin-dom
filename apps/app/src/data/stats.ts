import { useQuery } from '@tanstack/react-query';
import { useApi } from './api';

export type StatsRange = 'week' | 'month';

export function useStats(homeId: string | null, range: StatsRange) {
  const api = useApi();
  return useQuery({
    queryKey: ['stats', homeId, range],
    queryFn: () => api.stats(homeId!, range),
    enabled: homeId !== null,
  });
}
