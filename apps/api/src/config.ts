import { z } from 'zod';

const ConfigSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().int().default(8080),
  DATABASE_URL: z.string().default('postgres://klindom:klindom@localhost:5432/klindom'),
  AUTH_MODE: z.enum(['jwks', 'dev']).default('jwks'),
  AUTH_JWKS_URL: z.string().url().optional(),
  AUTH_ISSUER: z.string().optional(),
  AUTH_DEV_SECRET: z.string().optional(),
  ALLOW_DEV_AUTH: z.enum(['true', 'false']).default('false'),
  APP_URL: z.string().url().default('http://localhost:8081'),
  CRON_SECRET: z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const cleaned = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v !== ''));
  const config = ConfigSchema.parse(cleaned);
  if (config.AUTH_MODE === 'dev') {
    if (config.NODE_ENV === 'production') throw new Error('AUTH_MODE=dev is not allowed in production');
    if (config.ALLOW_DEV_AUTH !== 'true') throw new Error('AUTH_MODE=dev requires ALLOW_DEV_AUTH=true (local development only)');
    if (!config.AUTH_DEV_SECRET) throw new Error('AUTH_DEV_SECRET is required when AUTH_MODE=dev');
  } else if (!config.AUTH_JWKS_URL || !config.AUTH_ISSUER) {
    throw new Error('AUTH_JWKS_URL and AUTH_ISSUER are required when AUTH_MODE=jwks');
  }
  const vapid = [config.VAPID_PUBLIC_KEY, config.VAPID_PRIVATE_KEY, config.VAPID_SUBJECT];
  if (vapid.some(Boolean) && !vapid.every(Boolean)) {
    throw new Error('VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT must be set together');
  }
  if (config.VAPID_SUBJECT && !/^(mailto:|https:)/.test(config.VAPID_SUBJECT)) {
    throw new Error('VAPID_SUBJECT must start with mailto: or https:');
  }
  return config;
}
