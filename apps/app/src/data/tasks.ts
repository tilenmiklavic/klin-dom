import { useCallback, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useToast } from '@klindom/ui';
import type { ApiClient, CompletionDto, CompletionResultDto, DashboardDto, TaskDto, UndoResultDto } from '@klindom/shared';
import { useApi } from './api';
import { dashboardKey, type Scope } from './dashboard';
import { useBootstrap } from './useBootstrap';

export type CreateTaskInput = Parameters<ApiClient['createTask']>[1];
export type UpdateTaskPatch = Parameters<ApiClient['updateTask']>[1];

export const tasksKey = (homeId: string, scope?: Scope, roomId?: string) =>
  scope ? (['tasks', homeId, scope, roomId ?? null] as const) : (['tasks', homeId] as const);
export const taskKey = (taskId: string) => ['task', taskId] as const;
export const historyKey = (taskId: string) => ['history', taskId] as const;

/** Refreshes every task list, the task itself, its history and the dashboards. */
function invalidateTaskData(qc: QueryClient, homeId: string, taskId?: string) {
  void qc.invalidateQueries({ queryKey: tasksKey(homeId) });
  void qc.invalidateQueries({ queryKey: taskId ? taskKey(taskId) : ['task'] });
  void qc.invalidateQueries({ queryKey: taskId ? historyKey(taskId) : ['history'] });
  void qc.invalidateQueries({ queryKey: dashboardKey(homeId) });
}

type Done = DashboardDto['doneToday'][number];
type Patch = (d: DashboardDto) => DashboardDto;

const optimisticId = (taskId: string) => `optimistic:${taskId}`;
const bump = (r: DashboardDto['rings'], by: number): DashboardDto['rings'] => ({
  ...r,
  today: { ...r.today, done: Math.max(0, r.today.done + by) },
  week: { ...r.week, done: Math.max(0, r.week.done + by) },
});
export const asDone = (task: TaskDto, c: CompletionDto): Done => ({
  ...c,
  taskName: task.name,
  taskIcon: task.icon,
  roomNames: task.rooms.map((r) => r.name),
});

/** Applies `patch` to every cached dashboard of the home (both scopes). */
function patchDashboards(qc: QueryClient, homeId: string, patch: Patch, scope?: 'all') {
  qc.setQueriesData<DashboardDto>({ queryKey: dashboardKey(homeId, scope) }, (d) => (d ? patch(d) : d));
}

interface TickOp<V, R> {
  /** Calls that share a key are ignored while one is in flight. */
  key: (v: V) => string;
  call: (api: ReturnType<typeof useApi>, v: V) => Promise<R>;
  optimistic: (v: V, me: { id: string; name: string }) => Patch;
  /** Undoes `optimistic` on one cached dashboard; `before` is that dashboard as it was before the patch. */
  revert: (v: V, before: DashboardDto) => Patch;
  /** Patch applied once the server answered (for every scope). */
  settle?: (v: V, r: R) => Patch;
  rings: (r: R) => DashboardDto['rings'];
}

/**
 * Optimistic dashboard mutation: patches every cached dashboard first, then keeps the server's answer,
 * or reverts just this change (per cache, from what it held before) and toasts when the call fails.
 * A second call for the same key is ignored.
 */
function useTickOp<V, R>(homeId: string | null, op: TickOp<V, R>) {
  const api = useApi();
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation();
  const me = useBootstrap().data?.user;
  const inFlight = useRef(new Set<string>());
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const opRef = useRef(op);
  opRef.current = op;

  const run = useCallback(
    async (v: V): Promise<R | null> => {
      if (!homeId) return null;
      const o = opRef.current;
      const key = o.key(v);
      if (inFlight.current.has(key)) return null;
      inFlight.current.add(key);
      setPending(new Set(inFlight.current));
      try {
        await qc.cancelQueries({ queryKey: dashboardKey(homeId) });
        const before = qc.getQueriesData<DashboardDto>({
          queryKey: dashboardKey(homeId),
        });
        patchDashboards(qc, homeId, o.optimistic(v, { id: me?.id ?? '', name: me?.displayName ?? '' }));
        try {
          const result = await o.call(api, v);
          if (o.settle) patchDashboards(qc, homeId, o.settle(v, result));
          // Rings come from the server for the whole home; "mine" catches up on the refetch below.
          patchDashboards(qc, homeId, (d) => ({ ...d, rings: o.rings(result) }), 'all');
          invalidateTaskData(qc, homeId);
          return result;
        } catch {
          for (const [cacheKey, was] of before) {
            if (was) qc.setQueryData<DashboardDto>(cacheKey, (d) => (d ? o.revert(v, was)(d) : d));
          }
          toast.show({ message: t('errors.tickFailed') });
          invalidateTaskData(qc, homeId);
          return null;
        }
      } finally {
        inFlight.current.delete(key);
        setPending(new Set(inFlight.current));
      }
    },
    [homeId, api, qc, toast, t, me?.id, me?.displayName],
  );
  return { run, pending };
}

const withoutDue = (d: DashboardDto, taskId: string) => d.dueToday.filter((x) => x.id !== taskId);
/** Puts the task back at its index in `before`, only if that cache listed it and it is gone now. */
const restoreDue = (d: DashboardDto, before: DashboardDto, task: TaskDto) => {
  const at = before.dueToday.findIndex((x) => x.id === task.id);
  if (at < 0 || d.dueToday.some((x) => x.id === task.id)) return d.dueToday;
  return [...d.dueToday.slice(0, at), task, ...d.dueToday.slice(at)];
};
const lists = (d: DashboardDto, task: TaskDto) => d.dueToday.some((x) => x.id === task.id);
/** Ticks a task off. Always sends the task's own `nextDueDate`, which the server uses to dedupe. */
export function useCompleteTask(homeId: string | null) {
  const { run, pending } = useTickOp<TaskDto, CompletionResultDto>(homeId, {
    key: (task) => task.id,
    call: (api, task) => api.completeTask(task.id, task.nextDueDate),
    // Only caches that list the task change (a "mine" list may not include it).
    optimistic: (task, me) => (d) => {
      if (!lists(d, task)) return d;
      const row: Done = {
        id: optimisticId(task.id),
        taskId: task.id,
        kind: 'done',
        userId: me.id,
        userName: me.name,
        completedAt: new Date(Date.now()).toISOString(),
        dueDate: task.nextDueDate,
        onTime: !task.overdue,
        taskName: task.name,
        taskIcon: task.icon,
        roomNames: task.rooms.map((r) => r.name),
      };
      return {
        ...d,
        dueToday: withoutDue(d, task.id),
        doneToday: [...d.doneToday, row],
        rings: bump(d.rings, 1),
      };
    },
    revert: (task, before) => (d) => {
      if (!lists(before, task)) return d;
      return {
        ...d,
        dueToday: restoreDue(d, before, task),
        doneToday: d.doneToday.filter((x) => x.id !== optimisticId(task.id)),
        rings: bump(d.rings, -1),
      };
    },
    settle: (task, r) => (d) => ({
      ...d,
      doneToday: d.doneToday.map((x) => (x.id === optimisticId(task.id) ? asDone(task, r.completion) : x)),
    }),
    rings: (r) => r.rings,
  });
  return { complete: run, pending };
}

/** Skips a task's current occurrence. Skips do not count towards the rings. */
export function useSkipTask(homeId: string | null) {
  const { run, pending } = useTickOp<TaskDto, CompletionResultDto>(homeId, {
    key: (task) => task.id,
    call: (api, task) => api.skipTask(task.id),
    optimistic: (task) => (d) => {
      if (!lists(d, task)) return d;
      return { ...d, dueToday: withoutDue(d, task.id) };
    },
    revert: (task, before) => (d) => (lists(before, task) ? { ...d, dueToday: restoreDue(d, before, task) } : d),
    rings: (r) => r.rings,
  });
  return { skip: run, pending };
}

/** Undoes a completion: the row leaves "done" and the rings step back; the refetch returns the task to the list. */
export function useUndoCompletion(homeId: string | null) {
  const { run, pending } = useTickOp<Done, UndoResultDto>(homeId, {
    key: (c) => c.id,
    call: (api, c) => api.undoCompletion(c.id),
    optimistic: (c) => (d) => ({
      ...d,
      doneToday: d.doneToday.filter((x) => x.id !== c.id),
      rings: bump(d.rings, -1),
    }),
    revert: (c) => (d) => ({
      ...d,
      doneToday: d.doneToday.some((x) => x.id === c.id) ? d.doneToday : [...d.doneToday, c],
      rings: bump(d.rings, 1),
    }),
    settle: (_c, r) => (d) => ({
      ...d,
      dueToday: d.dueToday.some((x) => x.id === r.task.id) ? d.dueToday : [r.task, ...d.dueToday],
    }),
    rings: (r) => r.rings,
  });
  return { undo: run, pending };
}

/** Active tasks of a home; `mine` keeps the ones assigned to me or to the household. */
export function useTasks(homeId: string | null, scope: Scope, roomId?: string) {
  const api = useApi();
  return useQuery({
    queryKey: tasksKey(homeId ?? '', scope, roomId),
    queryFn: () => api.listTasks(homeId!, { scope, roomId }),
    enabled: homeId !== null,
  });
}

export function useTask(taskId: string | undefined) {
  const api = useApi();
  return useQuery({ queryKey: taskKey(taskId ?? ''), queryFn: () => api.getTask(taskId!), enabled: Boolean(taskId) });
}

export function useTaskHistory(taskId: string | undefined) {
  const api = useApi();
  return useQuery({ queryKey: historyKey(taskId ?? ''), queryFn: () => api.taskHistory(taskId!, 20), enabled: Boolean(taskId) });
}

export function useCreateTask(homeId: string | null) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => api.createTask(homeId!, input),
    onSuccess: () => invalidateTaskData(qc, homeId!),
  });
}

export function useUpdateTask(homeId: string | null, taskId: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateTaskPatch) => api.updateTask(taskId, patch),
    onSuccess: () => invalidateTaskData(qc, homeId!, taskId),
  });
}

export function useArchiveTask(homeId: string | null, taskId: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.archiveTask(taskId),
    onSuccess: () => {
      qc.removeQueries({ queryKey: taskKey(taskId) });
      invalidateTaskData(qc, homeId!, taskId);
    },
  });
}

export function useMuteTask(homeId: string | null, taskId: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (muted: boolean) => api.muteTask(taskId, muted),
    onSuccess: (task) => {
      qc.setQueryData(taskKey(taskId), task);
      invalidateTaskData(qc, homeId!, taskId);
    },
  });
}
