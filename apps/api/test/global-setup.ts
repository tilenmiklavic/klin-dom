import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://klindom:klindom@localhost:54329/klindom_test';

export default function setup() {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  execFileSync(
    'pnpm',
    ['exec', 'dbmate', '--url', `${TEST_DATABASE_URL}?sslmode=disable`, '--no-dump-schema', '--wait', 'drop'],
    { cwd: root, stdio: 'inherit' },
  );
  execFileSync(
    'pnpm',
    ['exec', 'dbmate', '--url', `${TEST_DATABASE_URL}?sslmode=disable`, '--no-dump-schema', 'up'],
    { cwd: root, stdio: 'inherit' },
  );
}
