import { randomInt } from 'node:crypto';
import type { Db } from '../db.js';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateInviteCode(): string {
  const pick = () => Array.from({ length: 3 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return `${pick()}-${pick()}`;
}

/** `k7q2mx`, `K7Q-2MX` and ` k7q-2mx ` all name the same invite. */
export function normalizeInviteCode(input: string): string {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return raw.length === 6 ? `${raw.slice(0, 3)}-${raw.slice(3)}` : raw;
}

export interface InviteRow {
  id: string;
  home_id: string;
  code: string;
  created_by: string;
  created_at: Date;
}

export async function insertInvite(db: Db, homeId: string, createdBy: string, now: Date): Promise<InviteRow> {
  for (let attempt = 0; ; attempt++) {
    try {
      const [row] = await db.query<InviteRow>(
        `insert into invites (home_id, code, created_by, created_at) values ($1, $2, $3, $4)
         returning id, home_id, code, created_by, created_at`,
        [homeId, generateInviteCode(), createdBy, now],
      );
      return row!;
    } catch (err) {
      if ((err as { code?: string }).code !== '23505' || attempt >= 5) throw err;
    }
  }
}

export async function findActiveInvite(db: Db, code: string) {
  const [row] = await db.query<InviteRow & { home_name: string; inviter_name: string | null }>(
    `select i.id, i.home_id, i.code, i.created_by, i.created_at, h.name as home_name, u.display_name as inviter_name
     from invites i join homes h on h.id = i.home_id join users u on u.id = i.created_by
     where i.code = $1 and i.revoked_at is null`,
    [normalizeInviteCode(code)],
  );
  return row;
}
