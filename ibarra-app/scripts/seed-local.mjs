/**
 * Apply CLI seeds without db reset.
 * seed_auth.sql is a pg_dump (not upsert). Skip it when auth.users already
 * has rows so re-running `pnpm seed:local` can load pasadas.
 */
import { execFileSync } from 'node:child_process';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const container = 'supabase_db_ibarra-app';

const FILES = [
  { file: 'supabase/seed_auth.sql', skipIfAuthSeeded: true },
  { file: 'supabase/seed_cli_login.sql' },
  { file: 'supabase/seed_rbac_schema.sql' },
  { file: 'supabase/seed_rbac.sql' },
  { file: 'supabase/seed_peajes_desarrollo.sql' },
  { file: 'supabase/seed_peajes_pasadas_fks.sql' },
  { file: 'supabase/pasadas_rows.sql' },
  { file: 'supabase/seed_peajes_f14.sql' },
];

function docker(args, opts = {}) {
  return execFileSync('docker', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: opts.stdio ?? 'pipe',
  });
}

function authUserCount() {
  const out = docker([
    'exec',
    container,
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-tAc',
    'select count(*)::int from auth.users;',
  ]);
  return Number.parseInt(String(out).trim(), 10) || 0;
}

function applySql(relPath) {
  const name = basename(relPath);
  const hostPath = join(root, relPath);
  const dest = `/tmp/${name}`;
  docker(['cp', hostPath, `${container}:${dest}`], { stdio: 'inherit' });
  docker(
    [
      'exec',
      container,
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-f',
      dest,
    ],
    { stdio: 'inherit' }
  );
}

let users = 0;
try {
  users = authUserCount();
} catch (err) {
  console.error(
    'Cannot reach local Postgres. Start the stack with `npx supabase start`.'
  );
  process.exit(1);
}

for (const step of FILES) {
  if (step.skipIfAuthSeeded && users > 0) {
    console.log(
      `[seed:local] skip ${basename(step.file)} (auth.users already has ${users} row(s))`
    );
    continue;
  }
  console.log(`[seed:local] apply ${basename(step.file)}`);
  applySql(step.file);
  if (step.skipIfAuthSeeded) {
    users = authUserCount();
  }
}

console.log('[seed:local] done');
