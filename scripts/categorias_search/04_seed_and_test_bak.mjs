/**
 * 04 — Seed local bak + staging via docker exec (Supabase local DB).
 * Never touches public.pasadas.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { HERE } from './lib.mjs';

const CONTAINER = process.env.SUPABASE_DB_CONTAINER || 'supabase_db_ibarra-app';
const SQL_DIR = path.join(HERE, 'sql');
const UPDATE_CSV = path.join(HERE, 'update_categoria_pasadas.csv');
const PASADAS_CSV = path.join(HERE, 'pasadas_rows.csv');
const TMP_SQL = path.join(HERE, '_tmp_seed_bak.sql');

function run(cmd, args) {
  const res = spawnSync(cmd, args, { encoding: 'utf8', shell: false });
  if (res.status !== 0) {
    console.error(res.stdout);
    console.error(res.stderr);
    throw new Error(`${cmd} ${args.join(' ')} failed with ${res.status}`);
  }
  return res.stdout;
}

function psqlFileOnHost(hostPath) {
  const remote = `/tmp/${path.basename(hostPath)}`;
  run('docker', ['cp', hostPath, `${CONTAINER}:${remote}`]);
  return run('docker', [
    'exec',
    '-i',
    CONTAINER,
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
    '-f',
    remote,
  ]);
}

function main() {
  if (!fs.existsSync(UPDATE_CSV)) {
    throw new Error('Missing update_categoria_pasadas.csv — run 01/02/03 first');
  }
  if (!fs.existsSync(PASADAS_CSV)) {
    throw new Error('Missing pasadas_rows.csv');
  }

  console.log('DDL: staging + minimal bak…');
  console.log(psqlFileOnHost(path.join(SQL_DIR, '01_create_staging.sql')));
  console.log(psqlFileOnHost(path.join(SQL_DIR, '02c_minimal_bak_for_local_test.sql')));

  run('docker', ['cp', PASADAS_CSV, `${CONTAINER}:/tmp/pasadas_rows.csv`]);
  run('docker', ['cp', UPDATE_CSV, `${CONTAINER}:/tmp/update_categoria_pasadas.csv`]);

  const seedSql = `
CREATE TEMP TABLE _pasadas_raw (
  id uuid,
  fecha_hora text,
  pase_id text,
  patente_id text,
  estacion_id text,
  documento_id text,
  precio numeric,
  bonificacion text,
  quantity text,
  importe_neto text,
  created_at text,
  user_id text,
  file_upload_name text
);

\\copy _pasadas_raw FROM '/tmp/pasadas_rows.csv' WITH (FORMAT csv, HEADER true);

TRUNCATE public.pasadas_categoria_bak;
INSERT INTO public.pasadas_categoria_bak (id, file_upload_name, precio, categoria)
SELECT id, file_upload_name, precio, NULL
FROM _pasadas_raw;

TRUNCATE public._stg_pasadas_categoria;
\\copy public._stg_pasadas_categoria(id,file_name,patente,tarifa,categoria,concesion) FROM '/tmp/update_categoria_pasadas.csv' WITH (FORMAT csv, HEADER true, NULL '');

SELECT 'bak_loaded' AS step, count(*) AS n FROM public.pasadas_categoria_bak
UNION ALL
SELECT 'stg_loaded', count(*) FROM public._stg_pasadas_categoria;
`;
  fs.writeFileSync(TMP_SQL, seedSql, 'utf8');
  console.log('Load CSV into bak + staging…');
  console.log(psqlFileOnHost(TMP_SQL));

  console.log('UPDATE bak only…');
  console.log(psqlFileOnHost(path.join(SQL_DIR, '03_update_categoria_on_backup.sql')));

  console.log('Verify…');
  console.log(psqlFileOnHost(path.join(SQL_DIR, '04_verify_backup.sql')));

  // Adjust verify: live pasadas may not exist — run a safe check
  const checkSql = path.join(HERE, '_tmp_check_live.sql');
  fs.writeFileSync(
    checkSql,
    `
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'pasadas'
) AS live_pasadas_exists;
`,
    'utf8',
  );
  console.log(psqlFileOnHost(checkSql));

  fs.unlinkSync(TMP_SQL);
  fs.unlinkSync(checkSql);
  console.log('Done. Only pasadas_categoria_bak / _stg_* were written.');
}

main();
