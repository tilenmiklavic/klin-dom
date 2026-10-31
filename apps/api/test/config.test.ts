import { loadConfig } from '../src/config.js';

it('treats empty env values as unset', () => {
  const config = loadConfig({ AUTH_MODE: 'dev', AUTH_DEV_SECRET: 's', AUTH_JWKS_URL: '', AUTH_ISSUER: '' });
  expect(config.AUTH_JWKS_URL).toBeUndefined();
});

it('refuses dev auth in production', () => {
  expect(() => loadConfig({ NODE_ENV: 'production', AUTH_MODE: 'dev', AUTH_DEV_SECRET: 's' })).toThrow(/not allowed/);
});
