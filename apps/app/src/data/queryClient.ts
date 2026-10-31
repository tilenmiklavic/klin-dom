import { AppState, Platform } from 'react-native';
import { focusManager, QueryClient } from '@tanstack/react-query';
import { ApiError } from '@klindom/shared';

/** Client errors (4xx) will not change on retry; network and 5xx errors might. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: true,
        refetchInterval: 30_000, // pauses while unfocused (refetchIntervalInBackground defaults to false)
        retry: shouldRetry,
      },
    },
  });
}

/** React Native has no window focus events: map app foregrounding onto react-query's focus manager. */
export function subscribeAppFocus(): () => void {
  if (Platform.OS === 'web') return () => undefined;
  const sub = AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));
  return () => sub.remove();
}
