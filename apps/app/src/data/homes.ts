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

export function useUpdateHome(homeId: string | null) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.updateHome(homeId!, { name }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['home', homeId] }),
        queryClient.invalidateQueries({ queryKey: bootstrapKey }),
      ]),
  });
}

export function useRemoveMember(homeId: string | null) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.removeMember(homeId!, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members', homeId] }),
  });
}

export function useTransferHome(homeId: string | null) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.transferHome(homeId!, userId),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['home', homeId] }),
        queryClient.invalidateQueries({ queryKey: ['members', homeId] }),
        queryClient.invalidateQueries({ queryKey: bootstrapKey }),
      ]),
  });
}

export function useLeaveHome(homeId: string | null) {
  const api = useApi();
  return useMutation({ mutationFn: () => api.leaveHome(homeId!) });
}

export function useDeleteHome(homeId: string | null) {
  const api = useApi();
  return useMutation({ mutationFn: (confirmName: string) => api.deleteHome(homeId!, confirmName) });
}

export function useUpdateMe() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (displayName: string) => api.updateMe({ displayName }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bootstrapKey }),
  });
}

export function useDeleteMe() {
  const api = useApi();
  // Paused queries must not pause this request, so it ignores the online state.
  return useMutation({ mutationFn: () => api.deleteMe(), networkMode: 'always' });
}
