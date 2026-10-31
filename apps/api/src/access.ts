import type { Role } from '@klindom/shared';
import type { Db } from './db.js';
import { HttpError } from './errors.js';

/** Non-members get 404 so a home's existence never leaks. */
export async function requireMember(db: Db, homeId: string, userId: string): Promise<{ role: Role }> {
  const [row] = await db.query<{ role: Role }>(
    'select role from home_members where home_id = $1 and user_id = $2',
    [homeId, userId],
  );
  if (!row) throw new HttpError(404, 'not_found', 'Home not found');
  return row;
}

export async function requireOwner(db: Db, homeId: string, userId: string): Promise<void> {
  const { role } = await requireMember(db, homeId, userId);
  if (role !== 'owner') throw new HttpError(403, 'forbidden', 'Only the home owner can do that');
}

/** Loads the home id of a home-scoped row, or 404s. */
export async function homeIdOf(db: Db, table: 'rooms' | 'tasks' | 'invites' | 'completions', id: string): Promise<string> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, 'not_found', 'Not found');
  const [row] = await db.query<{ home_id: string }>(`select home_id from ${table} where id = $1`, [id]);
  if (!row) throw new HttpError(404, 'not_found', 'Not found');
  return row.home_id;
}
