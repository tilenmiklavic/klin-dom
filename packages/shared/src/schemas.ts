import { z } from 'zod';
import type { Rings } from './rings.js';

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const Timezone = z.string().refine(isValidTimezone, 'Unknown timezone');
export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
export const TimeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:mm');

// Homes

export const SuggestionPick = z.object({
  rooms: z.array(z.object({ key: z.string(), count: z.number().int().min(1).max(5) })),
  taskKeys: z.array(z.string()),
});
export type SuggestionPick = z.infer<typeof SuggestionPick>;

export const CreateHomeInput = z.object({
  name: z.string().trim().min(1).max(60),
  timezone: Timezone,
  suggestions: SuggestionPick.optional(),
});
export type CreateHomeInput = z.infer<typeof CreateHomeInput>;

export const UpdateHomeInput = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  timezone: Timezone.optional(),
});

export const DeleteHomeInput = z.object({ confirmName: z.string() });
export const TransferHomeInput = z.object({ userId: z.string().uuid() });

export type Role = 'owner' | 'member';

export interface HomeDto {
  id: string;
  name: string;
  timezone: string;
  ownerId: string;
  role: Role;
}

export interface MemberDto {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: Role;
  joinedAt: string;
}

export interface MemberSettingsDto {
  notificationsEnabled: boolean;
  defaultReminderTime: string; // HH:mm
}

export const MemberSettingsInput = z
  .object({ notificationsEnabled: z.boolean(), defaultReminderTime: TimeOfDay })
  .partial();

// Push

export const PushSubscriptionInput = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
  userAgent: z.string().max(300).optional(),
});

// Rooms

export const iconNames = [
  'sparkle', 'spray', 'broom', 'sponge', 'bucket', 'vacuum', 'laundry', 'dishes', 'window',
  'home', 'calendar', 'checklist', 'timer', 'chat', 'stats', 'profile', 'mic',
] as const;
export type IconName = (typeof iconNames)[number];
export const IconNameSchema = z.enum(iconNames);

export const RoomInput = z.object({ name: z.string().trim().min(1).max(40), icon: IconNameSchema });
export const UpdateRoomInput = RoomInput.partial();
export const RoomOrderInput = z.object({ roomIds: z.array(z.string().uuid()) });

export interface RoomDto {
  id: string;
  name: string;
  icon: IconName;
  sortOrder: number;
}

// Tasks

export const IntervalUnitSchema = z.enum(['day', 'week', 'month']);

export const TaskInput = z.object({
  name: z.string().trim().min(1).max(60),
  icon: IconNameSchema,
  notes: z.string().max(500).nullish(),
  roomIds: z.array(z.string().uuid()).min(1),
  intervalCount: z.number().int().min(1).max(365),
  intervalUnit: IntervalUnitSchema,
  startDate: IsoDateSchema.optional(),
  dueTime: TimeOfDay.nullish(),
  assigneeId: z.string().uuid().nullish(),
  reminderOffsets: z
    .array(z.number().int().min(0).max(10080))
    .max(5)
    .refine((xs) => new Set(xs).size === xs.length, 'Reminder offsets must be unique')
    .optional(),
});
export type TaskInput = z.infer<typeof TaskInput>;
export const UpdateTaskInput = TaskInput.omit({ startDate: true }).partial();
export const MuteInput = z.object({ muted: z.boolean() });

export interface TaskDto {
  id: string;
  name: string;
  icon: IconName;
  notes: string | null;
  rooms: { id: string; name: string; icon: IconName }[];
  intervalCount: number;
  intervalUnit: 'day' | 'week' | 'month';
  dueTime: string | null;
  assigneeId: string | null;
  nextDueDate: string;
  lastCompletedAt: string | null;
  reminderOffsets: number[];
  mutedByMe: boolean;
  overdue: boolean;
}

// Completions

export const CompleteInput = z.object({ dueDate: IsoDateSchema.optional() });

export interface CompletionDto {
  id: string;
  taskId: string;
  kind: 'done' | 'skip';
  userId: string;
  userName: string;
  completedAt: string;
  dueDate: string;
  onTime: boolean;
}

// Suggestions

const SuggestedTask = z.object({
  key: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  icon: IconNameSchema,
  intervalCount: z.number().int().min(1),
  intervalUnit: IntervalUnitSchema,
});

export const SuggestionCatalog = z.object({
  rooms: z.array(z.object({ key: z.string().regex(/^[a-z0-9-]+$/), name: z.string(), icon: IconNameSchema, tasks: z.array(SuggestedTask) })),
  sharedTasks: z.array(SuggestedTask.extend({ roomKeys: z.array(z.string()).min(1) })),
});
export type SuggestionCatalog = z.infer<typeof SuggestionCatalog>;

// Responses without a request-side schema

export interface UserDto {
  id: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
}

export interface BootstrapDto {
  user: UserDto;
  homes: { id: string; name: string; role: Role }[];
}

export interface InviteDto {
  id: string;
  code: string;
  url: string;
  createdAt: string;
  createdBy: string;
}

export interface InvitePreviewDto {
  homeName: string;
  inviterName: string | null;
}

export interface CompletionResultDto {
  task: TaskDto;
  rings: Rings;
  completion: CompletionDto;
}

export interface UndoResultDto {
  task: TaskDto;
  rings: Rings;
}

export interface DashboardDto {
  rings: Rings;
  /** Consecutive days the household closed its today ring. */
  streak: number;
  dueToday: TaskDto[];
  doneToday: (CompletionDto & { taskName: string; taskIcon: IconName; roomNames: string[] })[];
}

export interface StatsDto {
  from: string;
  to: string;
  total: number;
  perMember: { userId: string; name: string; done: number; onTime: number }[];
  perRoom: { roomId: string; name: string; done: number }[];
  doneForOthers: { byUserId: string; forUserId: string; count: number }[];
  perDay: { date: string; done: number }[];
}
