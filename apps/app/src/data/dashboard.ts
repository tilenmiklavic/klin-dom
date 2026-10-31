import { useQuery } from '@tanstack/react-query';
import type { DashboardDto } from '@klindom/shared';
import { useApi } from './api';

export type Scope = 'all' | 'mine';

export const dashboardKey = (homeId: string, scope?: Scope) =>
  scope ? (['dashboard', homeId, scope] as const) : (['dashboard', homeId] as const);

/** Today's rings and tasks for a home. */
export function useDashboard(homeId: string | null, scope: Scope) {
  const api = useApi();
  return useQuery<DashboardDto>({
    queryKey: dashboardKey(homeId ?? '', scope),
    queryFn: () => api.dashboard(homeId!, scope),
    enabled: homeId !== null,
  });
}
