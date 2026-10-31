import { SuggestionCatalog, type IconName, type SuggestionPick } from '@klindom/shared';
import raw from '../../../db/seed/suggestions.json' with { type: 'json' };
import type { Db } from './db.js';
import { HttpError } from './errors.js';
import { setTaskReminders, setTaskRooms } from './repo/tasks.js';
import { insertRoom } from './repo/rooms.js';

/** Bundled at build time and validated on startup. */
export const catalog: SuggestionCatalog = SuggestionCatalog.parse(raw);

interface PlannedTask {
  name: string;
  icon: IconName;
  intervalCount: number;
  intervalUnit: 'day' | 'week' | 'month';
  roomIds: string[];
}

/** Creates the picked rooms (Bedroom, Bedroom 2, …) and tasks inside an open transaction. */
export async function applySuggestions(q: Db, homeId: string, userId: string, pick: SuggestionPick, today: string): Promise<void> {
  const roomIdsByKey = new Map<string, string[]>();
  for (const { key, count } of pick.rooms) {
    const room = catalog.rooms.find((r) => r.key === key);
    if (!room) throw new HttpError(400, 'invalid_input', `Unknown room suggestion: ${key}`);
    const ids: string[] = [];
    for (let n = 1; n <= count; n++) {
      ids.push((await insertRoom(q, homeId, n === 1 ? room.name : `${room.name} ${n}`, room.icon)).id);
    }
    roomIdsByKey.set(key, ids);
  }

  const wanted = new Set(pick.taskKeys);
  const planned: PlannedTask[] = [];
  for (const room of catalog.rooms) {
    for (const task of room.tasks) {
      if (!wanted.has(`${room.key}.${task.key}`)) continue;
      for (const roomId of roomIdsByKey.get(room.key) ?? []) planned.push({ ...task, roomIds: [roomId] });
    }
  }
  for (const task of catalog.sharedTasks) {
    if (!wanted.has(`shared.${task.key}`)) continue;
    const roomIds = task.roomKeys.flatMap((key) => roomIdsByKey.get(key) ?? []);
    if (roomIds.length > 0) planned.push({ ...task, roomIds });
  }

  for (const task of planned) {
    const [row] = await q.query<{ id: string }>(
      `insert into tasks (home_id, name, icon, interval_count, interval_unit, next_due_date, created_by)
       values ($1, $2, $3, $4, $5, $6, $7) returning id`,
      [homeId, task.name, task.icon, task.intervalCount, task.intervalUnit, today, userId],
    );
    await setTaskRooms(q, row!.id, task.roomIds);
    await setTaskReminders(q, row!.id, [0]);
  }
}
