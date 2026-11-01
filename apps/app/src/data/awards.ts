import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { HistoryDto } from '@klindom/shared';
import { useApi } from './api';

/** A month of daily rings plus every award earned, for the Awards & history screen. */
export function useHistory(homeId: string | null, month: string | null) {
  const api = useApi();
  return useQuery<HistoryDto>({
    queryKey: ['history', homeId, month],
    queryFn: () => api.history(homeId!, month!),
    enabled: homeId !== null && month !== null,
    // Keep the shown month while the neighbouring one loads.
    placeholderData: (prev) => prev,
  });
}

/** Tells the server the new awards were shown. Failures are swallowed: the celebration already happened. */
export function useMarkAwardsSeen(homeId: string | null) {
  const api = useApi();
  return useCallback(async () => {
    if (homeId === null) return;
    try {
      await api.markAwardsSeen(homeId);
    } catch {
      // A later load still lists them; the screen guards by award id, so nothing repeats.
    }
  }, [api, homeId]);
}
