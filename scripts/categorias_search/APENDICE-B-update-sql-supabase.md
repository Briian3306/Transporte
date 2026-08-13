# APÉNDICE B — SQL + prueba en backup (Supabase CLI)

## Safety

| Allowed in this toolkit | Forbidden |
|---|---|
| Create/update `public._stg_pasadas_categoria` | `UPDATE public.pasadas` during agent work |
| Create/update `public.pasadas_categoria_bak` | `db push` of these one-off SQL files into migrations |
| Load `update_categoria_pasadas.csv` into staging | Running `sql/99_apply_to_pasadas_MANUAL.sql` without explicit user request |

## SQL inventory (`sql/`)

| File | Purpose |
|---|---|
| `01_create_staging.sql` | Staging for join CSV |
| `02_backup_pasadas.sql` | Clone `pasadas` → `pasadas_categoria_bak` |
| `02b_load_bak_from_export.sql` | Optional: build bak when local `pasadas` is empty (structure + notes) |
| `03_update_categoria_on_backup.sql` | `UPDATE` **bak** from staging |
| `04_verify_backup.sql` | Counts / samples |
| `05_cleanup_test.sql` | Drop staging + bak |
| `99_apply_to_pasadas_MANUAL.sql` | Real apply — **manual only** |

## Local CLI test (preferred)

From `ibarra-app/`:

```bash
npx supabase status
# if needed: npx supabase start
```

Apply with `psql` using the local DB URL from `supabase status` (DB URL), e.g.:

```bash
# PowerShell example — replace DATABASE_URL
$env:PGPASSWORD = "postgres"
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f "..\scripts\categorias_search\sql\01_create_staging.sql"
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f "..\scripts\categorias_search\sql\02_backup_pasadas.sql"
```

Load CSV into staging (from `categorias_search/`):

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "\copy public._stg_pasadas_categoria(id,file_name,patente,tarifa,categoria,concesion) FROM 'update_categoria_pasadas.csv' WITH (FORMAT csv, HEADER true, NULL '')"
```

Then:

```bash
psql ... -f sql/03_update_categoria_on_backup.sql
psql ... -f sql/04_verify_backup.sql
```

Confirm live `pasadas` was **not** changed:

```sql
SELECT count(*) FILTER (WHERE categoria IS NOT NULL) AS with_cat
FROM public.pasadas;
-- Expect unchanged vs pre-test baseline.
```

## Later production apply (user only)

1. Review `update_categoria_pasadas.csv` and bak verify stats.
2. Load staging on the target project.
3. Run `99_apply_to_pasadas_MANUAL.sql` in SQL Editor (or CLI) **after** a snapshot/backup.
4. Re-check null counts by `file_upload_name`.
5. Drop staging.

## Test evidence (local CLI, 2026-08-12)

Local `public.pasadas` had **0 rows** (schema present). Used `sql/02c_minimal_bak_for_local_test.sql` + `04_seed_and_test_bak.mjs` (docker `supabase_db_ibarra-app`).

| Metric | Value |
|---|---|
| Node join written to `update_categoria_pasadas.csv` | **1750** |
| Unmatched total | 1715 (1711 ConsumosResumen + 4 CSV) |
| Ambiguous | 0 |
| Staging rows loaded | 1750 |
| Bak rows total | 3465 |
| Bak rows updated (`categoria` set) | **1750** |
| Bak still null | 1715 |
| ConsumosResumen `with_cat` | **0** (696 + 1015) |
| Live `pasadas` row count / with_cat | **0 / 0** (untouched) |
| Staging ids missing on bak after UPDATE | **0** |

Re-run test:

```bash
cd scripts/categorias_search
node 01_extract_db_keys.mjs
node 02_extract_source_categoria.mjs
node 03_join_update_categoria.mjs
node 04_seed_and_test_bak.mjs
```

Optional cleanup: `sql/05_cleanup_test.sql` via docker/`psql` (drops bak + staging only).

## DESARROLLO apply (2026-08-13) — steps 1–2 only

Project `kfffigvyvtzyczeiadxh`. Recalcular **not** run (QA pending).

| Metric | Value |
|---|---|
| F14 migrations on remote | already present (`20260812140628`…`53`) |
| Staging loaded | **1750** (0 ConsumosResumen) |
| `pasadas.categoria` set | **1750** |
| ConsumosResumen still null | **1711** (696 + 1015) |
| CSV still null (unmatched join) | 4 (`3305880` 1, `3313955` 1, `5364165` 2) |
| `tarifas_normalizadas` | **0** |
| `pasadas.tarifa_normalizada_id` | all null |

Staging table `public._stg_pasadas_categoria` left in place for QA.
