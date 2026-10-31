import type { Identity } from '../auth/verify.js';
import type { Db } from '../db.js';

export interface UserRow {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  deleted_at: Date | null;
}

export async function upsertUser(db: Db, identity: Identity): Promise<UserRow> {
  const [row] = await db.query<UserRow>(
    `insert into users (auth_provider, auth_subject, email, display_name, avatar_url)
     values ($1, $2, $3, $4, $5)
     on conflict (auth_provider, auth_subject) do update set
       email = coalesce(excluded.email, users.email),
       display_name = coalesce(excluded.display_name, users.display_name),
       avatar_url = coalesce(excluded.avatar_url, users.avatar_url)
     returning id, email, display_name, avatar_url, deleted_at`,
    [identity.provider, identity.subject, identity.email, identity.name, identity.avatarUrl],
  );
  return row!;
}
