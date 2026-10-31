import type { RoomDto } from '@klindom/shared';

/** `ids` is the user's order; keep it for rooms that still exist, drop gone ones, append new rooms in live order. */
export function reconcileOrder(ids: string[], live: RoomDto[]): RoomDto[] {
  const byId = new Map(live.map((r) => [r.id, r]));
  const kept = ids.flatMap((id) => byId.get(id) ?? []);
  const known = new Set(ids);
  return [...kept, ...live.filter((r) => !known.has(r.id))];
}
