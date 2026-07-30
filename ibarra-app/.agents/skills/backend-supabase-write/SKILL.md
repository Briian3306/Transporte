---
name: backend-supabase-write
description: >-
  Implements Supabase backend changes (RPC, SQL functions, views, triggers,
  policies, RLS, migrations) and Angular services that call Supabase for the
  Peajes / Transporte Ibarra project. Canonical flow: Supabase CLI (testing) ->
  DESARROLLO (remote). No separate staging/prod in this workflow. Writes
  reproducible SQL task scripts to docs/08-sql/{task}/. Requires skill supabase
  and supabase-postgres-best-practices for SQL. Does not replace
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

### DO NOT reuse OrdenCompra project refs

Forbidden (belong to another product):

- `edxoqshrzdqpnldktpzy`
- `uurlssweuhshbwpxxatw`

## Main responsibility

Implement backend changes as migrations + SQL task docs:

1. Write `supabase/migrations/`
2. Validate against **Supabase CLI** (`npx supabase db reset --local --no-seed`, `npx supabase test db`)
3. Document in `docs/08-sql/{task}/`
4. Only then consider DESARROLLO (`db push --linked`) with explicit user authorization when needed

After implementation, run:

1. `backend-documenter`
2. `backend-tester` (must verify against CLI)

**CLI rule:** from `ibarra-app/`, prefer `npx supabase` (npm lockfile). Do not assume global `supabase` or `pnpm supabase`.

Before any `--linked` command:

```powershell
Get-Content supabase\.temp\project-ref
# DESARROLLO expected: kfffigvyvtzyczeiadxh
```

## Required companion skills

| When… | Read |
|-------|------|
| Any Supabase backend change | [../supabase/SKILL.md](../supabase/SKILL.md) |
| SQL queries / indexes / RLS performance | [../supabase-postgres-best-practices/SKILL.md](../supabase-postgres-best-practices/SKILL.md) |

## Responsibilities

You can:

- Create/modify RPC, SQL functions, views, triggers, policies, RLS
- Create tables when the feature requires it
- Create migrations; write `docs/08-sql/{task}/`
- Update Edge Functions under `supabase/functions/`
- Implement Angular services under `src/app/components/peajes/**/services/*.service.ts` that call Supabase (agent 01 ownership)

You must not:

- Create frontend wizard/plantillas UI (agents 02/03)
- Edit shared models/contracts owned by agent 00
- Reuse `checklist_templates` / `ChecklistTemplateService`
- Use MCP remote as the source of truth for testing (CLI is)
- Apply `db reset --linked` to DESARROLLO
- Commit secrets / `service_role` / Bearer tokens

## Standard local cycle

```powershell
cd ibarra-app
npx supabase migration new nombre_del_cambio
# edit supabase/migrations/<timestamp>_nombre_del_cambio.sql
npx supabase db reset --local --no-seed
npx supabase test db
```

DESARROLLO (only after CLI green + user authorization when required):

```powershell
npx supabase link --project-ref kfffigvyvtzyczeiadxh
Get-Content supabase\.temp\project-ref
npx supabase db push --linked --dry-run
npx supabase db push --linked
```

## SQL documentation

Every change → `docs/08-sql/{task}/` using [plantilla-sql-task.md](plantilla-sql-task.md).

## Peajes domain notes

- Physical model: pasada references `estacion_id`; peaje is derived via estación (PRD §12 / F01-2). Do not store `peaje_id` on `pasadas` unless PRD/handoff is updated.
- Templates live in `plantillas_configuracion` / `configuraciones_plantilla`, not checklists tables.
- Consume TypeScript contracts from `src/app/components/peajes/models/` (agent 00); do not redefine them.

## Completion checklist

- [ ] [entornos.md](entornos.md) followed (CLI = testing)
- [ ] Migration in `supabase/migrations/`
- [ ] CLI rebuild + tests green
- [ ] `docs/08-sql/{task}/` written
- [ ] No OrdenCompra refs used
- [ ] No secrets in migrations/docs
- [ ] Invoke `backend-documenter` then `backend-tester`

## References

- [entornos.md](entornos.md)
- [plantilla-sql-task.md](plantilla-sql-task.md)
- [../supabase/SKILL.md](../supabase/SKILL.md)
- [../supabase-postgres-best-practices/SKILL.md](../supabase-postgres-best-practices/SKILL.md)
- [../backend-documenter/SKILL.md](../backend-documenter/SKILL.md)
- [../backend-tester/SKILL.md](../backend-tester/SKILL.md)
- PRD: `docs/plan/peaje-prd-es.md`
- Handoff: `docs/session-handoff.md`
