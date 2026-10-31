import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { useApi } from './api';

export const bootstrapKey = ['bootstrap'] as const;

/** The signed-in user and their homes. Disabled while signed out. */
export function useBootstrap() {
  const api = useApi();
  const { status } = useAuth();
  return useQuery({ queryKey: bootstrapKey, queryFn: () => api.bootstrap(), enabled: status === 'signedIn' });
}
