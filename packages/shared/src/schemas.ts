import { z } from 'zod';

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
