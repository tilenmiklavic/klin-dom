import { createMiddleware } from 'hono/factory';
import type { AppDeps, AppEnv } from '../app.js';
import { HttpError } from '../errors.js';
import { upsertUser } from '../repo/users.js';

export function requireUser(deps: AppDeps) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const header = c.req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new HttpError(401, 'unauthorized', 'Sign in to continue');
    let identity;
    try {
      identity = await deps.verifier.verify(token);
    } catch {
      throw new HttpError(401, 'unauthorized', 'Your session has expired, sign in again');
    }
    const user = await upsertUser(deps.db, identity);
    if (user.deleted_at) throw new HttpError(401, 'unauthorized', 'This account was deleted');
    c.set('user', { id: user.id, displayName: user.display_name, email: user.email, avatarUrl: user.avatar_url });
    await next();
  });
}
