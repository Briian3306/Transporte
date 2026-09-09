/**
 * Idempotent local stack guard for `pnpm dev` and `pnpm seed:local`.
 * Skips start when Kong (54321) already answers /auth/v1/health.
 * If Kong is down, stop then start --ignore-health-check so a half-dead
 * stack (Postgres up, Kong exited) is not left "already running".
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AUTH_HEALTH_URL,
  RECOVERY_HINT,
  START_ARGS,
  isKongHealthy,
} from './local-supabase.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function runSupabase(args) {
  const result = spawnSync('npx', ['supabase', ...args], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  });
  return result.status ?? 1;
}

if (await isKongHealthy()) {
  console.log(`[ensure-supabase-local] healthy ${AUTH_HEALTH_URL}`);
  process.exit(0);
}

console.log('[ensure-supabase-local] Kong down; stop then start');
runSupabase(['stop']);
const startStatus = runSupabase(START_ARGS);
if (startStatus !== 0) {
  console.error(RECOVERY_HINT);
  process.exit(startStatus);
}

if (!(await isKongHealthy(fetch, 8000))) {
  console.error(RECOVERY_HINT);
  process.exit(1);
}

console.log(`[ensure-supabase-local] recovered ${AUTH_HEALTH_URL}`);
