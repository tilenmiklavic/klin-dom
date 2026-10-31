import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { ApiClient } from '@klindom/shared';
import { useApi } from './api';
import { dashboardKey } from './dashboard';
import { tasksKey } from './tasks';

export type CreateRoomInput = Parameters<ApiClient['createRoom']>[1];
export type UpdateRoomPatch = Parameters<ApiClient['updateRoom']>[1];

export const roomsKey = (homeId: string) => ['rooms', homeId] as const;

export function useRooms(homeId: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: roomsKey(homeId ?? ''),
    queryFn: () => api.listRooms(homeId!),
    enabled: homeId !== null,
    staleTime: 60_000,
    refetchInterval: false,
  });
}

/** Rooms show up on tasks and in the dashboard, so any room change refreshes all three. */
function invalidateRoomData(qc: QueryClient, homeId: string) {
  void qc.invalidateQueries({ queryKey: roomsKey(homeId) });
  void qc.invalidateQueries({ queryKey: tasksKey(homeId) });
  void qc.invalidateQueries({ queryKey: ['task'] });
  void qc.invalidateQueries({ queryKey: dashboardKey(homeId) });
}

export function useCreateRoom(homeId: string | null) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRoomInput) => api.createRoom(homeId!, input),
    onSuccess: () => invalidateRoomData(qc, homeId!),
  });
}

export function useUpdateRoom(homeId: string | null, roomId: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateRoomPatch) => api.updateRoom(roomId, patch),
    onSuccess: () => invalidateRoomData(qc, homeId!),
  });
}

export function useArchiveRoom(homeId: string | null, roomId: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.archiveRoom(roomId),
    onSuccess: () => invalidateRoomData(qc, homeId!),
  });
}

export function useReorderRooms(homeId: string | null) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roomIds: string[]) => api.reorderRooms(homeId!, roomIds),
    onSuccess: () => invalidateRoomData(qc, homeId!),
  });
}
