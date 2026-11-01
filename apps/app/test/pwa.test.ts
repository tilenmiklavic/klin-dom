import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { registerServiceWorker } from '../src/pwa/register.web';

const publicDir = join(__dirname, '..', 'public');

describe('web manifest', () => {
  const manifest = JSON.parse(readFileSync(join(publicDir, 'manifest.webmanifest'), 'utf8'));

  it('has name KlinDom, display standalone, theme/background #f2f2f2, start_url /', () => {
    expect(manifest.name).toBe('KlinDom');
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBe('#f2f2f2');
    expect(manifest.background_color).toBe('#f2f2f2');
    expect(manifest.start_url).toBe('/');
  });

  it('declares 192/512/maskable icons that exist on disk', () => {
    const find = (sizes: string, purpose: string) =>
      manifest.icons.find((i: { sizes: string; purpose?: string }) => i.sizes === sizes && (i.purpose ?? 'any') === purpose);
    for (const icon of [find('192x192', 'any'), find('512x512', 'any'), find('512x512', 'maskable')]) {
      expect(icon).toBeDefined();
      expect(existsSync(join(publicDir, icon.src))).toBe(true);
    }
  });
});

describe('index.html', () => {
  const html = readFileSync(join(publicDir, 'index.html'), 'utf8');

  it('links the manifest, apple-touch-icon, theme-color and iOS standalone tags', () => {
    expect(html).toMatch(/<link rel="manifest" href="\/manifest\.webmanifest"/);
    expect(html).toMatch(/<link rel="apple-touch-icon" href="\/icons\/apple-touch-icon\.png"/);
    expect(html).toMatch(/<meta name="theme-color" content="#f2f2f2"/);
    expect(html).toMatch(/viewport-fit=cover/);
    expect(html).toMatch(/<meta name="apple-mobile-web-app-capable" content="yes"/);
  });

  it('keeps the Expo root element', () => {
    expect(html).toContain('id="root"');
  });
});

describe('registerServiceWorker', () => {
  const register = jest.fn(() => Promise.resolve());
  const g = globalThis as unknown as Record<string, unknown>;
  const original = { navigator: g.navigator, location: g.location, dev: g.__DEV__ };

  beforeEach(() => {
    register.mockClear();
    Object.defineProperty(g, 'navigator', { value: { serviceWorker: { register } }, configurable: true });
    Object.defineProperty(g, 'location', { value: { protocol: 'https:', hostname: 'klindom.app' }, configurable: true });
  });
  afterAll(() => {
    Object.defineProperty(g, 'navigator', { value: original.navigator, configurable: true });
    Object.defineProperty(g, 'location', { value: original.location, configurable: true });
    g.__DEV__ = original.dev;
  });

  it('is a no-op in __DEV__', () => {
    g.__DEV__ = true;
    registerServiceWorker();
    expect(register).not.toHaveBeenCalled();
  });

  it('registers /sw.js in production over https', () => {
    g.__DEV__ = false;
    registerServiceWorker();
    expect(register).toHaveBeenCalledWith('/sw.js');
  });

  it('registers on localhost over http but not on other http hosts', () => {
    g.__DEV__ = false;
    Object.defineProperty(g, 'location', { value: { protocol: 'http:', hostname: 'localhost' }, configurable: true });
    registerServiceWorker();
    expect(register).toHaveBeenCalledTimes(1);
    Object.defineProperty(g, 'location', { value: { protocol: 'http:', hostname: 'example.com' }, configurable: true });
    registerServiceWorker();
    expect(register).toHaveBeenCalledTimes(1);
  });
});
