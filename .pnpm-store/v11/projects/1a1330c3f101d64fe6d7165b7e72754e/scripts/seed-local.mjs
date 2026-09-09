/**
 * Apply CLI seeds without db reset.
 * seed_auth.sql is a pg_dump (not upsert). Skip it only when
 * francis@transporteibarra.com.ar already exists so leftover rows
 * do not block Auth. seed_cli_login.sql always runs (CLI password).
 * package.json then runs migrate-tarifario-v2.mjs --load-local (tarifas v2).
 */
import { execFileSync } from 'node:child_process';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLI_LOGIN_EMAIL, shouldSkipSeedAuth } from './local-supabase.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const container = 'supabase_db_ibarra-app';

const FILES = [
  { file: 'supabase/seed_auth.sql', skipIfFrancisExists: true },
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

function francisExists() {
  const escaped = CLI_LOGIN_EMAIL.replace(/'/g, "''");
  const out = docker([
    'exec',
    container,
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-tAc',
    `select exists(select 1 from auth.users where email = '${escaped}');`,
  ]);
  return String(out).trim() === 't';
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

let francis = false;
try {
  francis = francisExists();
} catch (err) {
  console.error(
    'Cannot reach local Postgres. Run `pnpm seed:local` (ensures Kong) or `npx supabase start --ignore-health-check`.'
  );
  process.exit(1);
}

for (const step of FILES) {
  if (step.skipIfFrancisExists && shouldSkipSeedAuth(francis)) {
    console.log(
      `[seed:local] skip ${basename(step.file)} (${CLI_LOGIN_EMAIL} already in auth.users)`
    );
    continue;
  }
  console.log(`[seed:local] apply ${basename(step.file)}`);
  applySql(step.file);
  if (step.skipIfFrancisExists) {
    francis = francisExists();
  }
}

console.log('[seed:local] done');
