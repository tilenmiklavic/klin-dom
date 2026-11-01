// Builds dist/sw.js: bundle web/sw.ts, then let Workbox inject the precache manifest of dist/.
// Run after `expo export --platform web`.
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { injectManifest } from 'workbox-build';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

// Workbox's glob skips dot-directories, and Expo emits assets (fonts, images) under
// assets/__node_modules/.pnpm/..., so list them ourselves. Their file names carry a content hash.
const hashedAssets = (dir) =>
  readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && /\.(png|ttf|woff2)$/.test(e.name))
    .map((e) => ({ url: relative(dist, join(e.parentPath, e.name)).split('\\').join('/'), revision: null }));

const tmp = mkdtempSync(join(tmpdir(), 'klindom-sw-'));
const bundled = join(tmp, 'sw.js');

try {
  await build({ entryPoints: [join(root, 'web', 'sw.ts')], bundle: true, minify: true, format: 'iife', target: 'es2020', outfile: bundled });
  const { count, size, warnings } = await injectManifest({
    swSrc: bundled,
    swDest: join(dist, 'sw.js'),
    globDirectory: dist,
    // No source maps; the SW itself is not precached.
    globPatterns: ['**/*.{js,css,html,png,ttf,woff2,webmanifest}'],
    globIgnores: ['sw.js', 'assets/**'],
    additionalManifestEntries: hashedAssets(join(dist, 'assets')),
    maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
  });
  warnings.forEach((w) => console.warn(w));
  console.log(`sw.js precaches ${count} files (${(size / 1024).toFixed(0)} KiB)`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
