import type { IsoDate, RoomDto, TaskDto } from '@klindom/shared';
import { roomFreshness, roomStatus, type RoomStatus } from './status';

export interface RoomSummary {
  room: RoomDto;
  freshness: number;
  status: RoomStatus;
}

/** A room's tasks are the active tasks that list it; a task in several rooms counts in each. */
export function summarizeRooms(rooms: RoomDto[], tasks: TaskDto[], today: IsoDate): RoomSummary[] {
  return rooms.map((room) => {
    const own = tasks.filter((t) => t.rooms.some((r) => r.id === room.id));
    return { room, freshness: roomFreshness(own, today), status: roomStatus(own, today) };
  });
}
