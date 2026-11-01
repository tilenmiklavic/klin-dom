import { loadConfig, loadWorkerConfig } from '../src/config.js';

it('treats empty env values as unset', () => {
  const config = loadConfig({ AUTH_MODE: 'dev', AUTH_DEV_SECRET: 's', ALLOW_DEV_AUTH: 'true', AUTH_JWKS_URL: '', AUTH_ISSUER: '' });
  expect(config.AUTH_JWKS_URL).toBeUndefined();
});

it('refuses dev auth in production', () => {
  expect(() => loadConfig({ NODE_ENV: 'production', AUTH_MODE: 'dev', AUTH_DEV_SECRET: 's' })).toThrow(/not allowed/);
});

describe('VAPID', () => {
  const base = { AUTH_MODE: 'dev', AUTH_DEV_SECRET: 's', ALLOW_DEV_AUTH: 'true' };

  it('VAPID keys must be set together', () => {
    expect(() => loadConfig({ ...base, VAPID_PUBLIC_KEY: 'pub' })).toThrow(/VAPID/);
    expect(() => loadConfig({ ...base, VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv' })).toThrow(/VAPID/);
    const ok = loadConfig({ ...base, VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv', VAPID_SUBJECT: 'mailto:a@b.si' });
    expect(ok.VAPID_PUBLIC_KEY).toBe('pub');
    expect(loadConfig(base).VAPID_PUBLIC_KEY).toBeUndefined();
  });

  it('VAPID_SUBJECT must start with mailto: or https:', () => {
    const keys = { ...base, VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv' };
    expect(() => loadConfig({ ...keys, VAPID_SUBJECT: 'http://x.si' })).toThrow(/VAPID_SUBJECT/);
    expect(loadConfig({ ...keys, VAPID_SUBJECT: 'https://x.si' }).VAPID_SUBJECT).toBe('https://x.si');
  });
});

describe('loadWorkerConfig', () => {
  it('does not require AUTH_* (the worker never verifies tokens)', () => {
    expect(loadWorkerConfig({ DATABASE_URL: 'postgres://x/y' }).DATABASE_URL).toBe('postgres://x/y');
    expect(() => loadConfig({ DATABASE_URL: 'postgres://x/y' })).toThrow(/AUTH_JWKS_URL/);
  });

  it('still validates VAPID', () => {
    expect(() => loadWorkerConfig({ VAPID_PUBLIC_KEY: 'pub' })).toThrow(/VAPID/);
    expect(() => loadWorkerConfig({ VAPID_PUBLIC_KEY: 'p', VAPID_PRIVATE_KEY: 'q', VAPID_SUBJECT: 'http://x.si' })).toThrow(/VAPID_SUBJECT/);
  });
});

describe('DATABASE_SSL', () => {
  const base = { AUTH_MODE: 'dev', AUTH_DEV_SECRET: 's', ALLOW_DEV_AUTH: 'true' };

  it('DATABASE_SSL defaults off and rejects unknown values', () => {
    expect(loadConfig(base).DATABASE_SSL).toBe('off');
    expect(loadConfig({ ...base, DATABASE_SSL: 'require' }).DATABASE_SSL).toBe('require');
    expect(loadWorkerConfig({ DATABASE_SSL: 'verify' }).DATABASE_SSL).toBe('verify');
    expect(() => loadConfig({ ...base, DATABASE_SSL: 'yes' })).toThrow();
  });
});
