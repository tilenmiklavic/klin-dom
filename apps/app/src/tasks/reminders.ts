import { eveningBeforeOffset, reminderPresets } from '@klindom/shared';

export type ReminderKey = (typeof reminderPresets)[number]['key'];
/** The evening-before reminder lands at 18:00 the day before; an any-time task is due 08:00 for this purpose. */
export const FALLBACK_DUE_TIME = '08:00';

export function presetMinutes(key: ReminderKey, dueTime: string | null): number {
  const preset = reminderPresets.find((p) => p.key === key)!;
  return preset.minutes ?? eveningBeforeOffset(dueTime, FALLBACK_DUE_TIME);
}

/** Which presets a stored list of offsets corresponds to, plus offsets no preset explains. */
export function keysFromOffsets(offsets: number[], dueTime: string | null): { keys: ReminderKey[]; extra: number[] } {
  const keys: ReminderKey[] = [];
  const matched = new Set<number>();
  for (const p of reminderPresets) {
    const minutes = presetMinutes(p.key, dueTime);
    if (offsets.includes(minutes) && !matched.has(minutes)) {
      keys.push(p.key);
      matched.add(minutes);
    }
  }
  return { keys, extra: offsets.filter((o) => !matched.has(o)) };
}

/** Unique offsets, ascending. */
export function offsetsFromKeys(keys: ReminderKey[], dueTime: string | null, extra: number[] = []): number[] {
  return [...new Set([...keys.map((k) => presetMinutes(k, dueTime)), ...extra])].sort((a, b) => a - b);
}
