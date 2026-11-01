import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MemberSettingsDto } from '@klindom/shared';
import { useApi } from './api';

type SettingsInput = Partial<MemberSettingsDto>;

export function useMemberSettings(homeId: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: ['memberSettings', homeId],
    queryFn: () => api.memberSettings(homeId!),
    enabled: homeId !== null,
  });
}

export function useUpdateMemberSettings(homeId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SettingsInput) => api.updateMemberSettings(homeId, input),
    onSuccess: (settings) => queryClient.setQueryData(['memberSettings', homeId], settings),
  });
}
