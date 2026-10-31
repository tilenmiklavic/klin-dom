import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from './api';

/** Codes are typed by hand: ignore case, dashes and spaces. */
export function normalizeInviteCode(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function useCreateInvite(homeId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.createInvite(homeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invites', homeId] }),
  });
}

export function useInvites(homeId: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: ['invites', homeId],
    queryFn: () => api.listInvites(homeId!),
    enabled: homeId !== null,
    refetchInterval: false,
  });
}

export function useRevokeInvite(homeId: string | null) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => api.revokeInvite(inviteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invites', homeId] }),
  });
}
