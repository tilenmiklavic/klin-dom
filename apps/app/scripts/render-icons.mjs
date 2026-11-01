// Renders the PWA icons into public/icons with Playwright. Run manually: node scripts/render-icons.mjs
// The PNGs are committed; this only needs re-running when the brand colours or sparkle change.
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(out, { recursive: true });

// Values from packages/ui (tokens.color.brand/onBrand, icons.sparkle; 24x24 viewBox).
const BRAND = '#e2643f';
const ON_BRAND = '#2a0e06';
const SPARKLE =
  'M11 2c.7 4.9 2.6 6.8 7.5 7.5-4.9.7-6.8 2.6-7.5 7.5-.7-4.9-2.6-6.8-7.5-7.5C8.4 8.8 10.3 6.9 11 2zM18.5 14c.4 2.6 1.4 3.6 4 4-2.6.4-3.6 1.4-4 4-.4-2.6-1.4-3.6-4-4 2.6-.4 3.6-1.4 4-4z';

/** Sparkle glyph scaled to `fraction` of the canvas, centred (the glyph spans x 3.5..22.5, y 2..22 of 24). */
const glyph = (fraction, fill) => {
  const s = (fraction * 24) / 19;
  return `<path transform="translate(${12 - 13 * s} ${12 - 12 * s}) scale(${s})" d="${SPARKLE}" fill="${fill}"/>`;
};

const svg = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%">${inner}</svg>`;
const rounded = (r) => `<rect width="24" height="24" rx="${r}" fill="${BRAND}"/>`;

const icons = [
  { file: 'icon-192.png', size: 192, markup: svg(rounded(5.4) + glyph(0.62, ON_BRAND)) },
  { file: 'icon-512.png', size: 512, markup: svg(rounded(5.4) + glyph(0.62, ON_BRAND)) },
  // Maskable: full-bleed brand square, glyph inside the 80% safe zone (OS applies its own mask).
  { file: 'maskable-512.png', size: 512, markup: svg(`<rect width="24" height="24" fill="${BRAND}"/>` + glyph(0.5, ON_BRAND)) },
  // iOS rounds the corners itself, so it also wants a full-bleed square.
  { file: 'apple-touch-icon.png', size: 180, markup: svg(`<rect width="24" height="24" fill="${BRAND}"/>` + glyph(0.62, ON_BRAND)) },
  // Notification badge: monochrome on transparent (Android uses only the alpha channel).
  { file: 'badge-72.png', size: 72, markup: svg(glyph(0.8, '#000000')), transparent: true },
];

const browser = await chromium.launch();
for (const { file, size, markup, transparent } of icons) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0;background:transparent;width:${size}px;height:${size}px">${markup}</body>`);
  await page.screenshot({ path: join(out, file), omitBackground: !!transparent });
  await page.close();
  console.log('wrote', file);
}
await browser.close();
