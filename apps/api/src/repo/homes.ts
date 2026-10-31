import type { HomeDto, MemberDto, Role } from '@klindom/shared';
import type { Db } from '../db.js';

export async function insertHome(db: Db, name: string, timezone: string, ownerId: string): Promise<string> {
  const [home] = await db.query<{ id: string }>(
    'insert into homes (name, timezone, owner_id) values ($1, $2, $3) returning id',
    [name, timezone, ownerId],
  );
  await db.query(`insert into home_members (home_id, user_id, role) values ($1, $2, 'owner')`, [home!.id, ownerId]);
  return home!.id;
}

export async function getHome(db: Db, homeId: string, userId: string): Promise<HomeDto> {
  const [row] = await db.query<{ id: string; name: string; timezone: string; owner_id: string; role: Role }>(
    `select h.id, h.name, h.timezone, h.owner_id, m.role from homes h
     join home_members m on m.home_id = h.id and m.user_id = $2 where h.id = $1`,
    [homeId, userId],
  );
  return { id: row!.id, name: row!.name, timezone: row!.timezone, ownerId: row!.owner_id, role: row!.role };
}

export async function homeTimezone(db: Db, homeId: string): Promise<string> {
  const [row] = await db.query<{ timezone: string }>('select timezone from homes where id = $1', [homeId]);
  return row!.timezone;
}

export async function listMembers(db: Db, homeId: string): Promise<MemberDto[]> {
  const rows = await db.query<{ user_id: string; display_name: string | null; avatar_url: string | null; role: Role; joined_at: Date }>(
    `select m.user_id, u.display_name, u.avatar_url, m.role, m.joined_at from home_members m
     join users u on u.id = m.user_id where m.home_id = $1 order by m.role desc, m.joined_at`,
    [homeId],
  );
  return rows.map((r) => ({
    userId: r.user_id,
    displayName: r.display_name,
    avatarUrl: r.avatar_url,
    role: r.role,
    joinedAt: r.joined_at.toISOString(),
  }));
}

/** Leaving or removal: history stays, assignments return to the household. */
export async function removeMembership(db: Db, homeId: string, userId: string): Promise<void> {
  await db.query('update tasks set assignee_id = null where home_id = $1 and assignee_id = $2', [homeId, userId]);
  await db.query(
    'delete from task_reminder_mutes where user_id = $2 and task_id in (select id from tasks where home_id = $1)',
    [homeId, userId],
  );
  await db.query('delete from home_members where home_id = $1 and user_id = $2', [homeId, userId]);
}

export async function memberCount(db: Db, homeId: string): Promise<number> {
  const [row] = await db.query<{ count: string }>('select count(*) from home_members where home_id = $1', [homeId]);
  return Number(row!.count);
}
