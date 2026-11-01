import type { AwardDto, AwardKind } from '@klindom/shared';
import type { Db } from '../db.js';

interface AwardRow {
  id: string;
  kind: AwardKind;
  user_id: string | null;
  user_name: string | null;
  earned_at: Date;
}

/** People who left the home or deleted their account show as "Former member". */
const SELECT_AWARDS = `
  select a.id, a.kind, a.user_id, a.earned_at,
         case when a.user_id is null then null
              when m.user_id is null or u.deleted_at is not null then 'Former member'
              else coalesce(u.display_name, 'Someone') end as user_name
  from awards a
  left join users u on u.id = a.user_id
  left join home_members m on m.home_id = a.home_id and m.user_id = a.user_id`;

const toAwardDto = (row: AwardRow): AwardDto => ({
  id: row.id,
  kind: row.kind,
  userId: row.user_id,
  userName: row.user_name,
  earnedAt: row.earned_at.toISOString(),
});

/** Every award of the home, newest first. */
export async function listAwards(db: Db, homeId: string): Promise<AwardDto[]> {
  const rows = await db.query<AwardRow>(`${SELECT_AWARDS} where a.home_id = $1 order by a.earned_at desc, a.id`, [homeId]);
  return rows.map(toAwardDto);
}

/** Household awards and the member's own that were earned after they last marked awards as seen. */
export async function listNewAwards(db: Db, homeId: string, userId: string): Promise<AwardDto[]> {
  const rows = await db.query<AwardRow>(
    `${SELECT_AWARDS}
     where a.home_id = $1 and (a.user_id is null or a.user_id = $2)
       and a.earned_at > (select awards_seen_at from home_members where home_id = $1 and user_id = $2)
     order by a.earned_at desc, a.id`,
    [homeId, userId],
  );
  return rows.map(toAwardDto);
}
