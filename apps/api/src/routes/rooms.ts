import { RoomInput, RoomOrderInput, UpdateRoomInput } from '@klindom/shared';
import { Hono } from 'hono';
import { homeIdOf, requireMember } from '../access.js';
import type { AppDeps, AppEnv } from '../app.js';
import { requireUser } from '../auth/middleware.js';
import { HttpError, parseBody } from '../errors.js';
import { getRoom, insertRoom, listRooms } from '../repo/rooms.js';

export function roomRoutes(deps: AppDeps) {
  const { db } = deps;
  const auth = requireUser(deps);
  const r = new Hono<AppEnv>();

  /** Active room in a home the caller belongs to, or 404. */
  async function loadRoom(roomId: string, userId: string) {
    const homeId = await homeIdOf(db, 'rooms', roomId);
    await requireMember(db, homeId, userId);
    const [row] = await db.query<{ archived_at: Date | null }>('select archived_at from rooms where id = $1', [roomId]);
    if (row!.archived_at) throw new HttpError(404, 'not_found', 'Room not found');
    return homeId;
  }

  r.get('/homes/:id/rooms', auth, async (c) => {
    await requireMember(db, c.req.param('id'), c.get('user').id);
    return c.json(await listRooms(db, c.req.param('id')));
  });

  r.post('/homes/:id/rooms', auth, async (c) => {
    const homeId = c.req.param('id');
    await requireMember(db, homeId, c.get('user').id);
    const input = await parseBody(c, RoomInput);
    return c.json(await insertRoom(db, homeId, input.name, input.icon), 201);
  });

  r.post('/homes/:id/rooms/order', auth, async (c) => {
    const homeId = c.req.param('id');
    await requireMember(db, homeId, c.get('user').id);
    const { roomIds } = await parseBody(c, RoomOrderInput);
    const active = (await listRooms(db, homeId)).map((room) => room.id);
    const same = roomIds.length === active.length && new Set(roomIds).size === roomIds.length && roomIds.every((id) => active.includes(id));
    if (!same) throw new HttpError(400, 'invalid_input', 'roomIds must list every room of the home exactly once');
    await db.tx(async (q) => {
      for (const [index, id] of roomIds.entries()) {
        await q.query('update rooms set sort_order = $2 where id = $1', [id, index + 1]);
      }
    });
    return c.json(await listRooms(db, homeId));
  });

  r.patch('/rooms/:id', auth, async (c) => {
    const roomId = c.req.param('id');
    await loadRoom(roomId, c.get('user').id);
    const input = await parseBody(c, UpdateRoomInput);
    await db.query('update rooms set name = coalesce($2, name), icon = coalesce($3, icon) where id = $1', [
      roomId,
      input.name ?? null,
      input.icon ?? null,
    ]);
    return c.json(await getRoom(db, roomId));
  });

  r.delete('/rooms/:id', auth, async (c) => {
    const roomId = c.req.param('id');
    await loadRoom(roomId, c.get('user').id);
    const [blocking] = await db.query<{ count: string }>(
      `select count(*) from task_rooms tr join tasks t on t.id = tr.task_id
       where tr.room_id = $1 and t.archived_at is null
         and (select count(*) from task_rooms o join rooms r on r.id = o.room_id
              where o.task_id = t.id and r.archived_at is null) = 1`,
      [roomId],
    );
    if (Number(blocking!.count) > 0) {
      throw new HttpError(409, 'room_has_tasks', 'Move or archive its tasks first');
    }
    await db.tx(async (q) => {
      await q.query('delete from task_rooms where room_id = $1', [roomId]);
      await q.query('update rooms set archived_at = now() where id = $1', [roomId]);
    });
    return c.body(null, 204);
  });

  return r;
}
