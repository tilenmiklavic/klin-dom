import { useMemo } from 'react';
import { createApiClient, type ApiClient } from '@klindom/shared';
import { useAuth } from '../auth/AuthProvider';
import { getConfig } from '../config';

/** The shared API client, wired to the session: bearer token from `useAuth`, one refresh on a 401. */
export function useApi(): ApiClient {
  const { getToken, refresh } = useAuth();
  return useMemo(
    () => createApiClient({ baseUrl: getConfig().apiUrl, getToken, onUnauthorized: refresh }),
    [getToken, refresh],
  );
}
