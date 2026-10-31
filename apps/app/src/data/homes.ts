import { useMutation, useQuery, useQueryClient, type UseMutationOptions } from '@tanstack/react-query';
import type { CreateHomeInput, HomeDto } from '@klindom/shared';
import { useApi } from './api';
import { bootstrapKey } from './useBootstrap';

export { useBootstrap } from './useBootstrap';

/** Re-reads the user's homes so the auth gate sees a home that was just created or joined. */
export function useRefreshBootstrap() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: bootstrapKey });
}

export function useCreateHome(options?: Pick<UseMutationOptions<HomeDto, Error, CreateHomeInput>, 'onSuccess' | 'onError'>) {
  const api = useApi();
  return useMutation({ mutationFn: (input: CreateHomeInput) => api.createHome(input), ...options });
}

/** The room and task catalog behind "Start with suggestions". It rarely changes. */
export function useSuggestions() {
  const api = useApi();
  return useQuery({
    queryKey: ['suggestions'],
    queryFn: () => api.suggestions(),
    staleTime: Infinity,
    refetchInterval: false,
  });
}

export function useInvitePreview(code: string) {
  const api = useApi();
  return useQuery({
    queryKey: ['invite', code],
    queryFn: () => api.previewInvite(code),
    enabled: code.length > 0,
    retry: false,
    refetchInterval: false,
  });
}

export function useAcceptInvite() {
  const api = useApi();
  return useMutation({ mutationFn: (code: string) => api.acceptInvite(code) });
}

/** The full home record: its timezone decides what "today" is. */
export function useHome(homeId: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: ['home', homeId],
    queryFn: () => api.getHome(homeId!),
    enabled: homeId !== null,
    staleTime: 5 * 60_000,
    refetchInterval: false,
  });
}

export function useMembers(homeId: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: ['members', homeId],
    queryFn: () => api.listMembers(homeId!),
    enabled: homeId !== null,
    staleTime: 60_000,
    refetchInterval: false,
  });
}
