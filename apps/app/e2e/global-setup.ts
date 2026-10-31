import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const healthUrl = 'http://localhost:8080/healthz';

/** Brings up postgres + migrate + api in dev-auth mode. Idempotent: reuses a running stack. */
export default async function globalSetup() {
  execFileSync('docker', ['compose', '-f', 'docker-compose.yml', '-f', 'compose.dev.yml', 'up', '-d', '--build'], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  const deadline = Date.now() + 120_000;
  for (;;) {
    try {
      if ((await fetch(healthUrl)).ok) return;
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) throw new Error(`API did not become healthy at ${healthUrl}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
}
