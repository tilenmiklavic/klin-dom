// Tiny static server for dist/ with SPA fallback; used by the PWA e2e (`node scripts/serve-dist.mjs [port]`).
// Mimics Cloudflare Pages' pretty URLs: /index.html -> 308 /index -> 308 /, so the e2e catches a
// service worker that hands a redirected response to a navigation.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const port = Number(process.argv[2] ?? process.env.PORT ?? 4173);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const send = async (file, status = 200) => {
    const body = await readFile(file);
    res.writeHead(status, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  };
  const redirect = { '/index.html': '/index', '/index': '/' }[path];
  if (redirect) {
    res.writeHead(308, { location: redirect });
    res.end();
    return;
  }
  try {
    await send(join(dist, path.endsWith('/') ? `${path}index.html` : path));
  } catch {
    // Unknown path: SPA fallback (like Cloudflare's `/* /index.html 200`).
    await send(join(dist, 'index.html')).catch(() => { res.writeHead(404); res.end(); });
  }
}).listen(port, () => console.log(`serving dist on http://localhost:${port}`));
