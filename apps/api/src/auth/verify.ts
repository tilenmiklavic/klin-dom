import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

export interface Identity {
  provider: string;
  subject: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

export interface TokenVerifier {
  verify(token: string): Promise<Identity>;
}

function toIdentity(provider: string, payload: JWTPayload): Identity {
  if (!payload.sub) throw new Error('Token has no subject');
  const meta = (payload.user_metadata ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v.length > 0 ? v : null);
  return {
    provider,
    subject: payload.sub,
    email: str(payload.email),
    name: str(meta.full_name) ?? str(meta.name),
    avatarUrl: str(meta.avatar_url),
  };
}

/** Production: Supabase (or any OIDC-style issuer) via its JWKS endpoint. */
export function jwksVerifier(opts: { jwksUrl: string; issuer: string; audience?: string }): TokenVerifier {
  const jwks = createRemoteJWKSet(new URL(opts.jwksUrl));
  return {
    async verify(token) {
      const { payload } = await jwtVerify(token, jwks, { issuer: opts.issuer, audience: opts.audience });
      return toIdentity('supabase', payload);
    },
  };
}

/** Local development and tests only: HS256 tokens signed with a shared secret. */
export function devVerifier(secret: string): TokenVerifier {
  const key = new TextEncoder().encode(secret);
  return {
    async verify(token) {
      const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
      return toIdentity('dev', payload);
    },
  };
}
