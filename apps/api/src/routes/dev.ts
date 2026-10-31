import { SignJWT } from 'jose';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppDeps, AppEnv } from '../app.js';
import { parseBody } from '../errors.js';

const DevTokenInput = z.object({
  sub: z.string().min(1),
  name: z.string().optional(),
  email: z.string().optional(),
});

/** Local development only: mints HS256 tokens the dev verifier accepts. Registered only when AUTH_MODE=dev. */
export function devRoutes(deps: AppDeps) {
  const r = new Hono<AppEnv>();
  r.post('/dev/token', async (c) => {
    const input = await parseBody(c, DevTokenInput);
    const token = await new SignJWT({ email: input.email, user_metadata: { full_name: input.name } })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(input.sub)
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(new TextEncoder().encode(deps.config.AUTH_DEV_SECRET));
    return c.json({ token });
  });
  return r;
}
