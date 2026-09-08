# Task 2: Add Schema and Direction-Aware Shadow Columns

Read this first — it is your requirements, with the exact values to use verbatim.

**This dispatch is Task 2 RED (Backend tester only).** Do not write the production migration yet. The Backend write agent implements SQL after these tests fail for the right reason.

**Owner (this dispatch):** Backend tester  
**Required skills:**
- `ibarra-app/.agents/skills/backend-tester/SKILL.md`
- `ibarra-app/.agents/skills/test-driven-development/SKILL.md` (or superpowers TDD if that path is what you use)
- `ibarra-app/.agents/skills/supabase/SKILL.md` (read-only for local CLI testing patterns)
- `ibarra-app/.agents/skills/supabase-postgres-best-practices/SKILL.md` (for what to assert, not to write prod SQL)

**Files:**
- Create: `ibarra-app/supabase/tests/peajes_f14_tarifas_importe_test.sql`
- Do **not** create or edit `ibarra-app/supabase/migrations/20260907100000_peajes_tarifas_v2_schema.sql` in this dispatch
- Do **not** edit product docs, ETL, or Angular

**Consumes:** Workbook contracts and the schema in plan sections 2–6.  
**Produces (this dispatch):** Failing pgTAP that the v2 schema does not exist yet.

## Plan steps for the tester

- [ ] Write pgTAP assertions that the new tables/columns exist; `pasadas.sentido` defaults to `AMBAS`; invalid direction/status/category values fail; and `tarifas_normalizadas` still exists with its legacy FK intact.
- [ ] Run `npx supabase db reset --local --no-seed` and `npx supabase test db` from `ibarra-app`; confirm the **new** test fails because the v2 schema does not exist.
- [ ] Do not apply anything to DESARROLLO.
- [ ] Do not commit.

## Schema the tests must demand (empty tables; no data load)

### `public.tarifas`

| Column | Type and rule |
|---|---|
| `id` | `uuid primary key` |
| `peaje_id` | `uuid not null` FK `peajes(id)` |
| `estacion_id` | `uuid not null` FK `estaciones(id)` |
| `status` | `text not null check (status in ('PICO','NO_PICO'))` |
| `categoria` | `smallint not null check (categoria between 0 and 10)` |
| `sentido` | `text not null default 'AMBAS' check (sentido in ('IDA','VUELTA','AMBAS'))` |
| `requiere_normalizacion_iva` | `boolean not null default false` |
| `current_tarifa_id` | `uuid` nullable during bootstrap (Task 2 allows null; Task 3 tightens pointer ownership) |
| `fecha_actualizacion` | `timestamptz not null` |
| `created_at`, `updated_at` | `timestamptz not null default now()` |

Unique `(peaje_id, estacion_id, status, categoria, sentido)`.

### `public.tarifa_importe`

| Column | Type and rule |
|---|---|
| `id` | `uuid primary key` |
| `tarifa_id` | `uuid not null` FK `tarifas(id)` |
| `importe` | `numeric(14,2) not null check (importe > 0)` |
| `importe_base`, `desvio` | legacy-compatible `numeric` |
| `hora_min`, `hora_max`, `hora_media` | `numeric(5,2)` nullable |
| `categoria_calculated` | `smallint nullable check (between 0 and 10)` |
| `fecha_aparicion` | `timestamptz not null` |
| `tarifas_normalizadas_id` | nullable `uuid` FK to `tarifas_normalizadas`, unique when non-null |
| `created_at`, `updated_at` | `timestamptz not null default now()` |

`status` and `categoria` live only on `tarifas`, not duplicated on `tarifa_importe`.

### `pasadas` shadow columns

- `pasadas.sentido text not null default 'AMBAS'` — do **not** add `pasadas.peaje_id`
- `pasadas.tarifa_importe_id uuid null` with FK to `tarifa_importe(id)` and index
- Retain `pasadas.tarifa_normalizada_id` indefinitely

### Indexes / RLS (assert existence at a high level if the local suite can)

- `tarifa_importe` unique `(tarifa_id, id)` for later composite pointer FK (Task 3)
- unique partial `tarifas_normalizadas_id where tarifas_normalizadas_id is not null`
- index `(tarifa_id, fecha_aparicion desc, created_at desc, id desc)`
- `pasadas` index `(tarifa_importe_id)` and partial shadow-backlog index `(estacion_id, categoria, tarifa_status, sentido, precio) where tarifa_importe_id is null`
- RLS follows existing authenticated-all pattern; grants match existing tariff tables

Do **not** implement the current-pointer composite FK or immutability triggers here (Task 3).

## Hard constraints

- **Do not remove, rename, or alter `tarifas_normalizadas` or its existing FKs.** Tests must prove it still exists with its legacy FK intact.
- Do not edit an already-applied migration.
- Supabase CLI local only. No DESARROLLO (`kfffigvyvtzyczeiadxh`) migration, data, or reset.
- Do not commit unless the user asks.
- Follow existing pgTAP style in `ibarra-app/supabase/tests/` (e.g. `peajes_f14_fecha_aparicion_test.sql`).
- TDD: tests first; they must fail because tables/columns are missing, not because the test file is syntactically broken.

## Must not modify

SQL production logic, ETL logic, product docs, Angular. Do not create the Task 2 migration file.

## Report

Write full report to `.superpowers/sdd/task-2-report.md` with TDD RED evidence (command, failing output, why the failure is expected). No GREEN yet.
