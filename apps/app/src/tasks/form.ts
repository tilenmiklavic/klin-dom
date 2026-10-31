import type { IconName, TaskDto } from '@klindom/shared';
import type { CreateTaskInput, UpdateTaskPatch } from '../data/tasks';
import { keysFromOffsets, offsetsFromKeys, type ReminderKey } from './reminders';

export interface FormState {
  name: string;
  icon: IconName;
  roomIds: string[];
  count: number;
  unit: 'day' | 'week' | 'month';
  startDate: string;
  /** "HH:mm", or "" for any time. */
  dueTime: string;
  assigneeId: string | null;
  reminderKeys: ReminderKey[];
  /** Stored offsets none of the presets explains; kept so editing never drops them silently. */
  extraOffsets: number[];
  notes: string;
}

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export function isValidDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

export const blankForm = (today: string): FormState => ({
  name: '',
  icon: 'sparkle',
  roomIds: [],
  count: 1,
  unit: 'week',
  startDate: today,
  dueTime: '',
  assigneeId: null,
  reminderKeys: [],
  extraOffsets: [],
  notes: '',
});

export function formFromTask(task: TaskDto, today: string): FormState {
  const { keys, extra } = keysFromOffsets(task.reminderOffsets, task.dueTime);
  return {
    name: task.name,
    icon: task.icon,
    roomIds: task.rooms.map((r) => r.id),
    count: task.intervalCount,
    unit: task.intervalUnit,
    startDate: today,
    dueTime: task.dueTime ?? '',
    assigneeId: task.assigneeId,
    reminderKeys: keys,
    extraOffsets: extra,
    notes: task.notes ?? '',
  };
}

const offsetsOf = (f: FormState) => offsetsFromKeys(f.reminderKeys, f.dueTime || null, f.extraOffsets);

/** Optional fields are left out when untouched so the server's defaults apply. */
export function buildCreate(f: FormState, today: string): CreateTaskInput {
  return {
    name: f.name.trim(),
    icon: f.icon,
    roomIds: f.roomIds,
    intervalCount: f.count,
    intervalUnit: f.unit,
    reminderOffsets: offsetsOf(f),
    assigneeId: f.assigneeId,
    ...(f.startDate !== today ? { startDate: f.startDate } : {}),
    ...(f.dueTime ? { dueTime: f.dueTime } : {}),
    ...(f.notes.trim() ? { notes: f.notes.trim() } : {}),
  };
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
const sameList = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Only the fields that differ from the stored task. */
export function buildPatch(f: FormState, task: TaskDto): UpdateTaskPatch {
  const patch: UpdateTaskPatch = {};
  if (f.name.trim() !== task.name) patch.name = f.name.trim();
  if (f.icon !== task.icon) patch.icon = f.icon;
  if (!sameSet(f.roomIds, task.rooms.map((r) => r.id))) patch.roomIds = f.roomIds;
  if (f.count !== task.intervalCount) patch.intervalCount = f.count;
  if (f.unit !== task.intervalUnit) patch.intervalUnit = f.unit;
  if ((f.dueTime || null) !== task.dueTime) patch.dueTime = f.dueTime || null;
  if (f.assigneeId !== task.assigneeId) patch.assigneeId = f.assigneeId;
  if ((f.notes.trim() || null) !== task.notes) patch.notes = f.notes.trim() || null;
  const offsets = offsetsOf(f);
  if (!sameList(offsets, [...task.reminderOffsets].sort((a, b) => a - b))) patch.reminderOffsets = offsets;
  return patch;
}
