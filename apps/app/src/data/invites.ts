import { useMutation } from '@tanstack/react-query';
import { useApi } from './api';

/** Codes are typed by hand: ignore case, dashes and spaces. */
export function normalizeInviteCode(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function useCreateInvite(homeId: string) {
  const api = useApi();
  return useMutation({ mutationFn: () => api.createInvite(homeId) });
}
