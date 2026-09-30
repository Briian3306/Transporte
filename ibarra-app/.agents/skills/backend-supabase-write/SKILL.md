---
name: backend-supabase-write
description: >-
  Implements Supabase backend changes (RPC, SQL functions, views, triggers,
  policies, RLS, migrations) and Angular services that call Supabase for the
  Peajes / Transporte Ibarra project. Canonical flow: Supabase CLI (testing) ->
  DESARROLLO (remote). Git files in supabase/migrations/ are the source of
  truth for migration version IDs. No separate staging/prod in this workflow.
  Documents SQL/RPC under docs/backend/ (not docs/08-sql/). Requires skill
  supabase and supabase-postgres-best-practices for SQL. Does not replace
  backend-documenter or backend-tester.
---

# Backend Supabase Write — Peajes / Transporte

Expert assistant for Supabase backend work in **this** repo (`ibarra-app/`), not OrdenCompra.

## Environment contract (mandatory)

```text
Supabase CLI (local)  =  testing / verification
DESARROLLO (remote)   =  development remote only
```

| Environment | Role | Project ref | API URL |
|-------------|------|-------------|---------|
| **Supabase CLI** | All SQL/migration testing | Docker + CLI | `http://127.0.0.1:54321` |
| **DESARROLLO** | Remote development | `kfffigvyvtzyczeiadxh` | `https://kfffigvyvtzyczeiadxh.supabase.co` |

There is **no** staging/prod split in this flow. See [entornos.md](entornos.md).

**Source of truth for migration identity:** git files in `supabase/migrations/<YYYYMMDDHHMMSS>_<name>.sql`. The version ID is the filename timestamp. Local CLI and DESARROLLO `schema_migrations` must store that same ID. MCP is not the source of truth for versions or for SQL testing.

## Main responsibility

Implement backend changes as migrations + SQL task docs:

1. Write `supabase/migrations/`
2. Validate schema against **Supabase CLI** (`npx supabase db reset --local --no-seed`, `npx supabase test db`). `--no-seed` is required for pgTAP so fixtures stay synthetic.
3. Restore local app data after that reset (auth, pasadas, tarifario v2). `--no-seed` does **not** load catalog data; schema migrations do **not** insert tarifas v2.
4. Document under `docs/backend/` (RPC catalog + `peajes/` detail; **do not** use `docs/08-sql/`)
5. Only then consider DESARROLLO (`db push --linked`) with explicit user authorization when needed

After implementation, run:

1. `backend-documenter`
2. `backend-tester` (must verify against CLI)

**CLI rule:** from `ibarra-app/`, prefer `npx supabase` (npm lockfile). Do not assume global `supabase` or `pnpm supabase`.

Before any `--linked` command, confirm the ref **and** read [historial-migraciones.md](historial-migraciones.md):

```powershell
Get-Content supabase\.temp\project-ref
# DESARROLLO expected: kfffigvyvtzyczeiadxh
```

If `npx supabase projects list` does not include `kfffigvyvtzyczeiadxh`, the CLI token is the wrong org. Relink / `npx supabase login` before pushing. Never invent a second project ref (no OrdenCompra).

## Required companion skills

| When… | Read |
|-------|------|
| Any Supabase backend change | [../supabase/SKILL.md](../supabase/SKILL.md) |
| SQL queries / indexes / RLS performance | [../supabase-postgres-best-practices/SKILL.md](../supabase-postgres-best-practices/SKILL.md) |
| Before `--linked` / `db push` fails / MCP vs filename timestamps | [historial-migraciones.md](historial-migraciones.md) |

## Responsibilities

You can:

- Create/modify RPC, SQL functions, views, triggers, policies, RLS
- Create tables when the feature requires it
- Create migrations; document under `docs/backend/` (via `backend-documenter`)
- Update Edge Functions under `supabase/functions/`
- Implement Angular services under `src/app/components/peajes/**/services/*.service.ts` that call Supabase (agent 01 ownership)

You must not:

- Create frontend wizard/plantillas UI (agents 02/03)
- Edit shared models/contracts owned by agent 00
- Reuse `checklist_templates` / `ChecklistTemplateService`
- Use MCP remote as the source of truth for testing (CLI is)
- Apply `db reset --linked` to DESARROLLO
- Commit secrets / `service_role` / Bearer tokens

## Canonical schema-change flow

Git filenames are the source of truth. Create them with the CLI; never invent timestamps by hand.

```text
need change the schema
        ↓
npx supabase migration new <nombre>
        ↓
editar archivo SQL
        ↓
npx supabase db reset --local --no-seed
        ↓
npx supabase test db
        ↓
npx supabase db push --linked --dry-run
        ↓
npx supabase db push --linked
```

After local tests, restore app data with `pnpm seed:local` unless the session is pgTAP-only. DESARROLLO push still requires explicit user authorization.

```powershell
cd ibarra-app
npx supabase start --ignore-health-check
npx supabase migration new nombre_del_cambio
# edit supabase/migrations/<timestamp>_nombre_del_cambio.sql

npx supabase db reset --local --no-seed
npx supabase test db
pnpm seed:local

# DESARROLLO (user OK)
Get-Content supabase\.temp\project-ref
npx supabase db push --linked --dry-run
npx supabase db push --linked
```

`pnpm seed:local` is: `ensure-supabase-local` → `scripts/seed-local.mjs` → `node scripts/peajes-catalogo-audit/migrate-tarifario-v2.mjs --load-local`.

Do **not** stop after `--no-seed`. That leaves empty `tarifas` / `tarifa_importe` / `_stg_precio_last` and no Francis login. Tarifario v2 is a Node ETL (workbook), not a file in `config.toml` `[db.seed]`. Never put `--load-local` against DESARROLLO.

After a DESARROLLO push, restore local CLI the same way (`db reset --local --no-seed` + `pnpm seed:local`) if the app will be used. Do not leave the Docker DB on `--no-seed` only.

## Forbidden

- Use MCP `apply_migration` when a local file already exists in `supabase/migrations/`
- Use MCP `execute_sql` for DDL on the remote
- Use MCP as an automatic fallback if `db push` fails
- Invent timestamps manually (always `npx supabase migration new <nombre>`)
- Change DESARROLLO schema before the change passed locally (`db reset --local --no-seed` + `npx supabase test db`)
- `db reset --linked` against DESARROLLO
- OrdenCompra project refs

## MCP — allowed (inspect only)

MCP is for reading DESARROLLO, not for deploying schema.

- `list_migrations`
- `list_tables` / inspect tables
- `execute_sql` **SELECT** only
- Validate remote objects exist
- `get_advisors`
- Investigate drift (compare remote versions vs git filenames)

Do not use MCP `apply_migration`, `execute_sql` DDL, or writes to `schema_migrations` as the deploy path.

## If `db push` returns 403

**Stop the deployment.** Do not use MCP as fallback.
The org is `biwtzryhjnrfotytnied`
1. Confirm `supabase\.temp\project-ref` is `kfffigvyvtzyczeiadxh`.
2. Run `npx supabase projects list`. DESARROLLO (`Check-list` / `kfffigvyvtzyczeiadxh`) must appear and be linked.
3. If it does not: `npx supabase login` with an org member that can write this project, then `npx supabase link --project-ref kfffigvyvtzyczeiadxh`.
4. Retry `db push --linked --dry-run` only after the CLI account is correct.

Do not invent a second project ref. Do not fall back to MCP `apply_migration`.

## Emergency MCP apply (same session only)

Only with **explicit** user authorization, and only after the 403/auth investigation above. This is not the default path.

MCP `apply_migration` generates its own timestamp (`T_mcp`), which will desync git. Repair history in the **same session** so the remote ID matches the local filename (`T_local`):

```text
Emergency MCP apply
        ↓
obtener T_mcp (list_migrations)
        ↓
npx supabase migration repair --linked --status reverted <T_mcp>
        ↓
npx supabase migration repair --linked --status applied <T_local>
        ↓
npx supabase migration list --linked
```

Confirm a single ID per change, equal to the git filename. If you skip the repair, the next `db push` will fail. Details: [historial-migraciones.md](historial-migraciones.md).

## SQL / RPC documentation

Every change → `docs/backend/` (see [plantilla-sql-task.md](plantilla-sql-task.md) and skill `backend-documenter`). **Do not create or update `docs/08-sql/`.**

## Peajes domain notes

- Physical model: pasada references `estacion_id`; peaje is derived via estación (PRD §12 / F01-2). Do not store `peaje_id` on `pasadas` unless PRD/handoff is updated.
- Templates live in `plantillas_configuracion` / `configuraciones_plantilla`, not checklists tables.
- Consume TypeScript contracts from `src/app/components/peajes/models/` (agent 00); do not redefine them.

## Completion checklist

- [ ] [entornos.md](entornos.md) followed (CLI = testing)
- [ ] Migration in `supabase/migrations/` created with `migration new` (no hand-invented timestamp)
- [ ] CLI rebuild + tests green (`db reset --local --no-seed` + `test db`)
- [ ] After `--no-seed` (and after DESARROLLO push), `pnpm seed:local` unless the session is pgTAP-only
- [ ] DESARROLLO applied with `db push --linked` (filename timestamp), not MCP `apply_migration`
- [ ] `--linked` history aligned per [historial-migraciones.md](historial-migraciones.md)
- [ ] `docs/backend/` updated (catalog + peajes detail as needed)
- [ ] No OrdenCompra refs used
- [ ] No secrets in migrations/docs
- [ ] Invoke `backend-documenter` then `backend-tester`

## References

- [entornos.md](entornos.md)
- [historial-migraciones.md](historial-migraciones.md)
- [plantilla-sql-task.md](plantilla-sql-task.md)
- [../supabase/SKILL.md](../supabase/SKILL.md)
- [../supabase-postgres-best-practices/SKILL.md](../supabase-postgres-best-practices/SKILL.md)
- [../backend-documenter/SKILL.md](../backend-documenter/SKILL.md)
- [../backend-tester/SKILL.md](../backend-tester/SKILL.md)
- PRD: `docs/plan/peaje-prd-short.md.md`
- Handoff: `docs/session-handoff.md`
