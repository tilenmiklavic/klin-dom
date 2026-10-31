import type { z } from 'zod';
import type {
  BootstrapDto,
  CompletionDto,
  CompletionResultDto,
  CreateHomeInput,
  DashboardDto,
  HomeDto,
  IconName,
  InviteDto,
  InvitePreviewDto,
  MemberDto,
  RoomDto,
  StatsDto,
  SuggestionCatalog,
  TaskDto,
  TaskInput,
  UndoResultDto,
  UpdateHomeInput,
  UpdateRoomInput,
  UpdateTaskInput,
  UserDto,
} from './schemas.js';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  getToken: () => Promise<string | null>;
  /** Called once on a 401. Return true after refreshing the session to retry the request once. */
  onUnauthorized?: () => Promise<boolean>;
  fetchImpl?: typeof fetch;
}

type Scope = 'all' | 'mine';
type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

const qs = (params: Record<string, string | undefined>) => {
  const entries = Object.entries(params).filter((e): e is [string, string] => e[1] !== undefined);
  return entries.length ? `?${new URLSearchParams(entries)}` : '';
};

export function createApiClient(opts: ApiClientOptions) {
  const doFetch = opts.fetchImpl ?? fetch;

  async function send(method: Method, path: string, body: unknown): Promise<Response> {
    const token = await opts.getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    try {
      return await doFetch(`${opts.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (e) {
      throw new ApiError(0, 'network', e instanceof Error ? e.message : 'Network request failed');
    }
  }

  async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
    let res = await send(method, path, body);
    if (res.status === 401 && opts.onUnauthorized && (await opts.onUnauthorized())) {
      res = await send(method, path, body);
    }
    if (res.ok) return (res.status === 204 ? undefined : await res.json()) as T;
    const payload = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    throw new ApiError(res.status, payload?.error?.code ?? 'unknown', payload?.error?.message ?? res.statusText);
  }

  const get = <T>(path: string) => request<T>('GET', path);
  const post = <T>(path: string, body: unknown = {}) => request<T>('POST', path, body);
  const patch = <T>(path: string, body: unknown) => request<T>('PATCH', path, body);
  const del = <T = void>(path: string, body?: unknown) => request<T>('DELETE', path, body);

  return {
    bootstrap: () => post<BootstrapDto>('/me/bootstrap'),
    /** Local development only: exists when the API runs with AUTH_MODE=dev. */
    devToken: (input: { sub: string; name?: string; email?: string }) => post<{ token: string }>('/dev/token', input),
    updateMe: (patchBody: { displayName: string }) => patch<UserDto>('/me', patchBody),
    deleteMe: () => del('/me'),

    createHome: (input: z.input<typeof CreateHomeInput>) => post<HomeDto>('/homes', input),
    getHome: (homeId: string) => get<HomeDto>(`/homes/${homeId}`),
    updateHome: (homeId: string, patchBody: z.input<typeof UpdateHomeInput>) => patch<HomeDto>(`/homes/${homeId}`, patchBody),
    deleteHome: (homeId: string, confirmName: string) => del(`/homes/${homeId}`, { confirmName }),
    listMembers: (homeId: string) => get<MemberDto[]>(`/homes/${homeId}/members`),
    removeMember: (homeId: string, userId: string) => del(`/homes/${homeId}/members/${userId}`),
    leaveHome: (homeId: string) => post<{ homeDeleted: boolean }>(`/homes/${homeId}/leave`),
    transferHome: (homeId: string, userId: string) => post<HomeDto>(`/homes/${homeId}/transfer`, { userId }),

    createInvite: (homeId: string) => post<InviteDto>(`/homes/${homeId}/invites`),
    listInvites: (homeId: string) => get<InviteDto[]>(`/homes/${homeId}/invites`),
    revokeInvite: (inviteId: string) => del(`/invites/${inviteId}`),
    previewInvite: (code: string) => get<InvitePreviewDto>(`/invites/${encodeURIComponent(code)}`),
    acceptInvite: (code: string) => post<HomeDto>(`/invites/${encodeURIComponent(code)}/accept`),

    listRooms: (homeId: string) => get<RoomDto[]>(`/homes/${homeId}/rooms`),
    createRoom: (homeId: string, input: { name: string; icon: IconName }) => post<RoomDto>(`/homes/${homeId}/rooms`, input),
    updateRoom: (roomId: string, patchBody: z.input<typeof UpdateRoomInput>) => patch<RoomDto>(`/rooms/${roomId}`, patchBody),
    reorderRooms: (homeId: string, roomIds: string[]) => post<RoomDto[]>(`/homes/${homeId}/rooms/order`, { roomIds }),
    archiveRoom: (roomId: string) => del(`/rooms/${roomId}`),

    listTasks: (homeId: string, filter: { scope?: Scope; roomId?: string } = {}) =>
      get<TaskDto[]>(`/homes/${homeId}/tasks${qs(filter)}`),
    createTask: (homeId: string, input: z.input<typeof TaskInput>) => post<TaskDto>(`/homes/${homeId}/tasks`, input),
    getTask: (taskId: string) => get<TaskDto>(`/tasks/${taskId}`),
    updateTask: (taskId: string, patchBody: z.input<typeof UpdateTaskInput>) => patch<TaskDto>(`/tasks/${taskId}`, patchBody),
    archiveTask: (taskId: string) => del(`/tasks/${taskId}`),
    muteTask: (taskId: string, muted: boolean) => request<TaskDto>('PUT', `/tasks/${taskId}/mute`, { muted }),
    completeTask: (taskId: string, dueDate: string) => post<CompletionResultDto>(`/tasks/${taskId}/complete`, { dueDate }),
    skipTask: (taskId: string) => post<CompletionResultDto>(`/tasks/${taskId}/skip`),
    undoCompletion: (completionId: string) => del<UndoResultDto>(`/completions/${completionId}`),
    taskHistory: (taskId: string, limit?: number) =>
      get<CompletionDto[]>(`/tasks/${taskId}/history${qs({ limit: limit?.toString() })}`),

    dashboard: (homeId: string, scope: Scope) => get<DashboardDto>(`/homes/${homeId}/dashboard${qs({ scope })}`),
    stats: (homeId: string, range: 'week' | 'month' | 'custom', from?: string, to?: string) =>
      get<StatsDto>(`/homes/${homeId}/stats${qs({ range, from, to })}`),
    suggestions: () => get<z.infer<typeof SuggestionCatalog>>('/suggestions'),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
