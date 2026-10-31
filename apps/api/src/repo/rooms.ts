import type { IconName, RoomDto } from '@klindom/shared';
import type { Db } from '../db.js';

interface RoomRow {
  id: string;
  name: string;
  icon: IconName;
  sort_order: number;
}

const toDto = (r: RoomRow): RoomDto => ({ id: r.id, name: r.name, icon: r.icon, sortOrder: r.sort_order });

export async function listRooms(db: Db, homeId: string): Promise<RoomDto[]> {
  const rows = await db.query<RoomRow>(
    'select id, name, icon, sort_order from rooms where home_id = $1 and archived_at is null order by sort_order, name',
    [homeId],
  );
  return rows.map(toDto);
}

export async function insertRoom(db: Db, homeId: string, name: string, icon: IconName): Promise<RoomDto> {
  const [row] = await db.query<RoomRow>(
    `insert into rooms (home_id, name, icon, sort_order)
     values ($1, $2, $3, (select coalesce(max(sort_order), 0) + 1 from rooms where home_id = $1))
     returning id, name, icon, sort_order`,
    [homeId, name, icon],
  );
  return toDto(row!);
}

export async function getRoom(db: Db, roomId: string): Promise<RoomDto> {
  const [row] = await db.query<RoomRow>('select id, name, icon, sort_order from rooms where id = $1', [roomId]);
  return toDto(row!);
}
